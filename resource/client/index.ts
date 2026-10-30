import { AdminWorld, cache, hidePrompt, loadLocaleTexts, notify, onPromptPressed, onServerEvent, progress, showPrompt, triggerServerCallback, Zones } from "@aicore-fivem/lib/client";
import { record } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readRoutes, toShift, type Shift } from "common/routes";

const world = new AdminWorld(["routes", "stops"]);
const texts = loadLocaleTexts();
const BLIP_TEXT = "AIJOBS_BLIP";
AddTextEntry(BLIP_TEXT, "~a~");
const errorText = (v: unknown, fallback: string): string => {
  const key = typeof record(v).error === "string" ? String(record(v).error) : fallback;
  return texts[key] ?? key;
};

/**
 * The player's shift: a route blip to the current stop, a zone around it with ai-core's prompt, the stop's progress
 * bar; depots show "start / stop working". The server picks every stop.
 */
class Work {
  shift: Shift | null = null;
  private readonly depotZones = new Zones();
  private readonly stopZone = new Zones();
  private stopBlip = 0;
  private depotBlips: number[] = [];

  rebuildDepots(): void {
    this.depotZones.clear();
    for (const blip of this.depotBlips) RemoveBlip(blip);
    this.depotBlips = [];
    for (const route of readRoutes(world.get("routes")).values()) {
      const id = `depot:${route.id}`;
      this.depotZones.add(id, {
        shape: { type: "sphere", center: route.depot, radius: 2 },
        interval: 500,
        onEnter: () => showPrompt(id, Locale(this.shift?.route === route.id ? "JOBS_PROMPT_STOP" : "JOBS_PROMPT_START", route.label)),
        onExit: () => hidePrompt(id),
      });
      const blip = AddBlipForCoord(route.depot.x, route.depot.y, route.depot.z);
      SetBlipSprite(blip, route.kind === "gather" ? 478 : 67);
      SetBlipColour(blip, 5);
      SetBlipScale(blip, 0.65);
      SetBlipAsShortRange(blip, true);
      BeginTextCommandSetBlipName(BLIP_TEXT);
      AddTextComponentSubstringPlayerName(route.label);
      EndTextCommandSetBlipName(blip);
      this.depotBlips.push(blip);
    }
  }

  set(shift: Shift | null): void {
    this.shift = shift;
    this.stopZone.clear();
    if (this.stopBlip) RemoveBlip(this.stopBlip);
    this.stopBlip = 0;
    hidePrompt("stop");
    if (!shift) return;
    const s = shift.stop;
    this.stopBlip = AddBlipForCoord(s.x, s.y, s.z);
    SetBlipColour(this.stopBlip, 5);
    SetBlipRoute(this.stopBlip, true);
    SetBlipRouteColour(this.stopBlip, 5);
    BeginTextCommandSetBlipName(BLIP_TEXT);
    AddTextComponentSubstringPlayerName(s.label);
    EndTextCommandSetBlipName(this.stopBlip);
    this.stopZone.add("stop", {
      shape: { type: "sphere", center: s, radius: 6 },
      interval: 300,
      onEnter: () => showPrompt("stop", Locale("JOBS_PROMPT_DO", s.label)),
      onExit: () => hidePrompt("stop"),
    });
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
onServerEvent(EVENTS.shift, { args: ([raw]) => [raw == null ? null : toShift(raw)] as const }, (shift) => work.set(shift));
onPromptPressed((id) => {
  if (id === "stop") void work.doStop();
  else if (id.startsWith("depot:")) void work.toggle(id.slice(6));
});
