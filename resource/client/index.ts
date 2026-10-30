import { AdminWorld, cache, createBlip, loadLocaleTexts, notify, onServerEvent, Points, progress, triggerServerCallback } from "@aicore-fivem/lib/client";
import { record } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readRoutes, toShift, type Shift } from "common/routes";

const world = new AdminWorld(["routes", "stops"]);
const texts = loadLocaleTexts();
const errorText = (v: unknown, fallback: string): string => {
  const key = typeof record(v).error === "string" ? String(record(v).error) : fallback;
  return texts[key] ?? key;
};

/**
 * The player's shift: a route blip to the current stop, a point there that runs the stop's progress bar; depots
 * offer "start / stop working". The server picks every stop.
 */
class Work {
  shift: Shift | null = null;
  private readonly depots = new Points();
  private readonly stopPoint = new Points();
  private stopBlip = 0;

  rebuildDepots(): void {
    this.depots.clear();
    for (const route of readRoutes(world.get("routes")).values()) {
      this.depots.add(`start:${route.id}`, {
        coords: route.depot,
        label: Locale("JOBS_PROMPT_START", route.label),
        icon: "briefcase",
        blip: { sprite: route.kind === "gather" ? 478 : route.kind === "tow" ? 68 : 67, color: 5, scale: 0.65, label: route.label },
        canShow: () => this.shift?.route !== route.id,
        onPressed: () => this.toggle(route.id),
      });
      this.depots.add(`stop:${route.id}`, {
        coords: route.depot,
        label: Locale("JOBS_PROMPT_STOP", route.label),
        icon: "circle-stop",
        canShow: () => this.shift?.route === route.id,
        onPressed: () => this.toggle(route.id),
      });
    }
  }

  set(shift: Shift | null): void {
    this.shift = shift;
    this.depots.refresh();
    this.stopPoint.clear();
    if (this.stopBlip) RemoveBlip(this.stopBlip);
    this.stopBlip = 0;
    if (!shift) return;
    const s = shift.stop;
    this.stopBlip = createBlip({ coords: s, label: s.label, sprite: 1, color: 5, scale: 1, shortRange: false });
    SetBlipRoute(this.stopBlip, true);
    SetBlipRouteColour(this.stopBlip, 5);
    this.stopPoint.add("stop", { coords: s, label: Locale("JOBS_PROMPT_DO", s.label), icon: "hand", radius: 6, interval: 300, onPressed: () => this.doStop() });
  }

  async doStop(): Promise<void> {
    const shift = this.shift;
    if (!shift) return;
    const route = readRoutes(world.get("routes")).get(shift.route);
    const seconds = route?.seconds ?? 5;
    const gather = route?.kind === "gather";
    if (!gather && cache.vehicle !== false && GetEntitySpeed(cache.vehicle) > 2) return notify(Locale("JOBS_STOP_VEHICLE"), "warning", 2500);
    const ok = await progress({
      label: Locale("JOBS_WORKING"),
      duration: seconds * 1000,
      anim: gather && !IsPedSwimmingUnderWater(cache.ped) ? { dict: "amb@prop_human_bum_bin@base", clip: "base" } : undefined,
      allowVehicle: !gather,
    });
    if (!ok) return;
    const result = record(await triggerServerCallback(EVENTS.arrive, [shift.stop.id]).catch(() => null));
    if (result.ok !== true) notify(errorText(result, "JOBS_ERR_FAR"), "error");
  }

  async toggle(routeId: string): Promise<void> {
    const working = this.shift?.route === routeId;
    const result = record(await triggerServerCallback(working ? EVENTS.stop : EVENTS.start, working ? [] : [routeId], 10_000).catch(() => null));
    if (result.ok !== true) return notify(errorText(result, "JOBS_ERR_FAR"), "error");
    notify(Locale(working ? "JOBS_STOPPED" : "JOBS_STARTED"), "success", 2500);
  }
}

const work = new Work();
work.rebuildDepots();
world.onChange("routes", () => work.rebuildDepots());
/** The towed car's owner attaches it to the flatbed (attachments replicate from the owner). */
onServerEvent(
  EVENTS.attach,
  { args: ([car, flatbed]): [number, number] | null => (typeof car === "number" && typeof flatbed === "number" ? [car, flatbed] : null) },
  (car, flatbed) => {
    if (!NetworkDoesEntityExistWithNetworkId(car) || !NetworkDoesEntityExistWithNetworkId(flatbed)) return;
    const bed = NetToVeh(flatbed);
    AttachEntityToEntity(NetToVeh(car), bed, GetEntityBoneIndexByName(bed, "bodyshell"), 0.0, -1.6, 1.0, 0, 0, 0, false, false, false, false, 20, true);
  },
);
onServerEvent(EVENTS.shift, { args: ([raw]) => [raw == null ? null : toShift(raw)] as const }, (shift) => work.set(shift));
