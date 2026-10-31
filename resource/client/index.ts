import {
  allows,
  cache,
  callAction,
  createBlip,
  notify,
  onMembershipChange,
  onServerEvent,
  Points,
  progress,
} from "@aicore-fivem/lib/client";
import { isPublic, readId, RecordObjects } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import {
  EVENTS,
  readRoute,
  toShift,
  type Route,
  type Shift,
} from "common/routes";
import { world } from "./content";
import "./hotdog";

/**
 * The player's shift: a route blip to the current stop, a point there that runs the stop's progress bar; depots
 * offer "start / stop working". The server picks every stop.
 */
class Work {
  shift: Shift | null = null;
  private readonly depots = new Points();
  private readonly stopPoint = new Points();
  private stopBlip = 0;

  /** Built after `depots`: `RecordObjects` builds at once. An edited route rebuilds only its own depot points. */
  readonly routes = new RecordObjects(world, "routes", readRoute, (id, route) =>
    this.buildDepot(id, route),
  );

  private buildDepot(id: string, route: Route): () => void {
    // A route locked to jobs or gangs shows (and has a blip) only for who passes its access rule.
    this.depots.add(`start:${id}`, {
      ped: route.ped ?? undefined,
      coords: route.depot,
      label: Locale("JOBS_PROMPT_START", route.label),
      icon: "briefcase",
      blip: allows(route.access)
        ? { ...route.blip, label: route.label }
        : undefined,
      canShow: () => this.shift?.route !== id && allows(route.access),
      onPressed: () => this.toggle(id),
    });
    this.depots.add(`stop:${id}`, {
      coords: route.depot,
      label: Locale("JOBS_PROMPT_STOP", route.label),
      icon: "circle-stop",
      canShow: () => this.shift?.route === id,
      onPressed: () => this.toggle(id),
    });
    return () => {
      this.depots.remove(`start:${id}`);
      this.depots.remove(`stop:${id}`);
    };
  }

  /** Blips follow memberships: only the locked routes are built again. */
  rebuildLocked(): void {
    for (const [id, route] of this.routes.records)
      if (!isPublic(route.access)) this.routes.rebuild(id);
  }

  set(shift: Shift | null): void {
    this.shift = shift;
    this.depots.refresh();
    this.stopPoint.clear();
    if (this.stopBlip) RemoveBlip(this.stopBlip);
    this.stopBlip = 0;
    if (!shift) return;
    const s = shift.stop;
    this.stopBlip = createBlip({
      coords: s,
      label: s.label,
      sprite: 1,
      color: 5,
      scale: 1,
      shortRange: false,
    });
    SetBlipRoute(this.stopBlip, true);
    SetBlipRouteColour(this.stopBlip, 5);
    this.stopPoint.add("stop", {
      coords: s,
      label: Locale("JOBS_PROMPT_DO", s.label),
      icon: "hand",
      radius: 6,
      interval: 300,
      onPressed: () => this.doStop(),
    });
  }

  async doStop(): Promise<void> {
    const shift = this.shift;
    if (!shift) return;
    const route = this.routes.records.get(shift.route);
    const seconds = route?.seconds ?? 5;
    const gather = route?.kind === "gather";
    if (!gather && cache.vehicle !== false && GetEntitySpeed(cache.vehicle) > 2)
      return notify(Locale("JOBS_STOP_VEHICLE"), "warning", 2500);
    const ok = await progress({
      label: Locale("JOBS_WORKING"),
      duration: seconds * 1000,
      anim:
        gather && !IsPedSwimmingUnderWater(cache.ped)
          ? { dict: "amb@prop_human_bum_bin@base", clip: "base" }
          : undefined,
      allowVehicle: !gather,
    });
    if (!ok) return;
    await callAction(EVENTS.arrive, [shift.stop.id], {
      fallback: "JOBS_ERR_FAR",
    });
  }

  async toggle(routeId: string): Promise<void> {
    const working = this.shift?.route === routeId;
    const result = await callAction(
      working ? EVENTS.stop : EVENTS.start,
      working ? [] : [routeId],
      { fallback: "JOBS_ERR_FAR", timeout: 10_000 },
    );
    if (!result) return;
    notify(Locale(working ? "JOBS_STOPPED" : "JOBS_STARTED"), "success", 2500);
  }
}

const work = new Work();
onMembershipChange(() => work.rebuildLocked());
/** The towed car's owner attaches it to the flatbed (attachments replicate from the owner). */
onServerEvent(
  EVENTS.attach,
  {
    args: ([car, flatbed]): [number, number] | null => {
      const a = readId(car);
      const b = readId(flatbed);
      return a === null || b === null ? null : [a, b];
    },
  },
  (car, flatbed) => {
    if (
      !NetworkDoesEntityExistWithNetworkId(car) ||
      !NetworkDoesEntityExistWithNetworkId(flatbed)
    )
      return;
    const bed = NetToVeh(flatbed);
    AttachEntityToEntity(
      NetToVeh(car),
      bed,
      GetEntityBoneIndexByName(bed, "bodyshell"),
      0.0,
      -1.6,
      1.0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      20,
      true,
    );
  },
);
onServerEvent(
  EVENTS.shift,
  { args: ([raw]) => [raw == null ? null : toShift(raw)] as const },
  (shift) => work.set(shift),
);
