import {
  aiLog,
  aiLogChannels,
  coordsOf,
  entityCoords,
  inventory,
  isNear,
  isOnline,
  notify,
  onClientCallback,
  online,
  PlayerMap,
  resourceExport,
  spawnVehicle,
} from "@aicore-fivem/lib/server";
import {
  distance,
  fail,
  oneArg,
  readText,
  RecordObjects,
  type Vec3,
} from "@aicore-fivem/lib/shared";
import { Locale, ResourceName } from "common";
import {
  EVENTS,
  readRoute,
  readStop,
  type Route,
  type Shift,
  type Stop,
} from "common/routes";
import { panel } from "./content";
import "./hotdog";

const core = resourceExport("ai-core");
const routes = panel.records("routes", readRoute);

/** Stops per route in id order, kept per edited stop (one stop edit touches one route's list). */
class RouteStops {
  private readonly byRoute = new Map<string, Map<string, Stop>>();
  private readonly sorted = new Map<string, Stop[]>();

  add(stop: Stop): () => void {
    let map = this.byRoute.get(stop.route);
    if (!map) this.byRoute.set(stop.route, (map = new Map()));
    map.set(stop.id, stop);
    this.sorted.delete(stop.route);
    return () => {
      map.delete(stop.id);
      if (map.size === 0) this.byRoute.delete(stop.route);
      this.sorted.delete(stop.route);
    };
  }

  /** A route's stops in id order (sorted once per change of that route). */
  of(route: string): Stop[] {
    let list = this.sorted.get(route);
    if (!list) {
      list = [...(this.byRoute.get(route)?.values() ?? [])].sort((a, b) =>
        a.id.localeCompare(b.id, "en", { numeric: true }),
      );
      this.sorted.set(route, list);
    }
    return list;
  }
}
const stops = new RouteStops();
new RecordObjects(panel, "stops", readStop, (_id, stop) => stops.add(stop));
// The hot dog stand logs its sales on `hotdog` (server/hotdog.ts).
aiLogChannels({ work: { active: false }, hotdog: { active: false } });

/** Fastest plausible travel between stops (m/s, ~216 km/h): a stop reached sooner was teleported to. */
const MAX_SPEED = 60;
/** The towed car counts as on the flatbed within this distance of the work vehicle. */
const TOW_REACH = 15;
const readTextId = oneArg((v) => readText(v, 64));

/**
 * A running shift: route, current stop (server picks it), progress, the work vehicle and when the stop began; tow
 * routes also keep the broken-down car waiting at the stop and whether it is on the flatbed.
 */
interface Work {
  route: Route;
  stop: Stop;
  done: number;
  vehicle: number | null;
  index: number;
  /** When the stop was handed out (game timer) and the earliest finish: travel from the last stop plus the stop's time. */
  since: number;
  minMs: number;
  towed: number;
  loaded: boolean;
}

async function spawnTowed(route: Route, stop: Stop): Promise<number> {
  const model =
    route.towModels[Math.floor(Math.random() * route.towModels.length)] ??
    "asea";
  const car = await spawnVehicle({
    model,
    type: "automobile",
    coords: { x: stop.x, y: stop.y, z: stop.z, heading: Math.random() * 360 },
    locked: true,
  });
  return car ?? 0;
}

/** Deletes a shift's work vehicle and towed car. */
function removeEntities(work: Work): void {
  for (const entity of [work.vehicle, work.towed])
    if (entity && DoesEntityExist(entity)) DeleteEntity(entity);
}

/** Hands out a stop: the earliest finish counts the way there at `MAX_SPEED` plus 80% of the stop's time. */
function assign(work: Work, stop: Stop, from: Vec3): void {
  work.stop = stop;
  work.since = GetGameTimer();
  work.minMs =
    (distance(from, stop) / MAX_SPEED) * 1000 + work.route.seconds * 800;
}

const depotStop = (route: Route): Stop => ({
  id: "depot",
  route: route.id,
  label: route.label,
  ...route.depot,
});
const shifts = new PlayerMap<Work>({
  onDrop: (_source, work) => removeEntities(work),
});

function nextStop(
  route: Route,
  work: Work | null,
): { stop: Stop; index: number } | null {
  const list = stops.of(route.id);
  if (list.length === 0) return null;
  if (route.kind === "ordered") {
    const index = work ? (work.index + 1) % list.length : 0;
    const stop = list[index];
    return stop ? { stop, index } : null;
  }
  const choices =
    list.length > 1 && work ? list.filter((s) => s.id !== work.stop.id) : list;
  const stop = choices[Math.floor(Math.random() * choices.length)];
  return stop ? { stop, index: list.indexOf(stop) } : null;
}

function send(source: number, work: Work | null): void {
  const shift: Shift | null = work
    ? {
        route: work.route.id,
        stop: work.stop,
        done: work.done,
        total: work.route.stops,
        netId: work.vehicle
          ? NetworkGetNetworkIdFromEntity(work.vehicle)
          : null,
      }
    : null;
  emitNet(EVENTS.shift, source, shift);
}

function end(source: number): void {
  const work = shifts.get(source);
  shifts.delete(source);
  if (work) removeEntities(work);
  send(source, null);
}

onClientCallback(
  EVENTS.start,
  { args: readTextId, lock: true },
  async (source, id) => {
    const route = routes.get(id);
    if (!route) return fail("JOBS_ERR_GONE");
    if (shifts.has(source)) return fail("JOBS_ERR_WORKING");
    if (!isNear(source, route.depot, 4)) return fail("JOBS_ERR_FAR");
    if (!online.allows(source, route.access)) return fail("JOBS_ERR_JOB");
    const first = nextStop(route, null);
    if (!first) return fail("JOBS_ERR_NO_STOPS");
    let vehicle: number | null = null;
    if (route.vehicle && route.kind !== "gather") {
      vehicle = await spawnVehicle({
        model: route.vehicle,
        asker: source,
        coords: route.spawn,
        plate: `WORK${source}`,
        keysTo: source,
        purpose: "job",
      });
      if (vehicle === null) return fail("JOBS_ERR_VEHICLE");
    }
    const towed =
      route.kind === "tow" ? await spawnTowed(route, first.stop) : 0;
    const work: Work = {
      route,
      stop: first.stop,
      done: 0,
      vehicle,
      index: first.index,
      since: 0,
      minMs: 0,
      towed,
      loaded: false,
    };
    // The player may have dropped while the vehicles spawned: nothing would clean them up later.
    if (!isOnline(source)) {
      removeEntities(work);
      return fail("JOBS_ERR_GONE");
    }
    assign(work, first.stop, route.depot);
    shifts.set(source, work);
    send(source, work);
    return { ok: true };
  },
);

onClientCallback(EVENTS.stop, (source) => {
  end(source);
  return { ok: true };
});

onClientCallback(
  EVENTS.arrive,
  { args: readTextId, lock: true },
  async (source, stopId) => {
    const work = shifts.get(source);
    if (!work || work.stop.id !== stopId) return fail("JOBS_ERR_GONE");
    const p = coordsOf(source);
    if (distance(p, work.stop) > 12) return fail("JOBS_ERR_FAR");
    if (GetGameTimer() - work.since < work.minMs) return fail("JOBS_ERR_FAST");
    if (
      work.route.kind !== "gather" &&
      work.vehicle &&
      (!DoesEntityExist(work.vehicle) ||
        distance(entityCoords(work.vehicle), p) > 15)
    )
      return fail("JOBS_ERR_VEHICLE_FAR");
    if (work.route.kind === "tow" && !work.loaded) {
      if (!work.towed || !DoesEntityExist(work.towed) || !work.vehicle)
        return fail("JOBS_ERR_GONE");
      // Only the owner client of the car can attach it.
      const owner = NetworkGetEntityOwner(work.towed);
      emitNet(
        EVENTS.attach,
        owner > 0 ? owner : source,
        NetworkGetNetworkIdFromEntity(work.towed),
        NetworkGetNetworkIdFromEntity(work.vehicle),
      );
      work.loaded = true;
      assign(work, depotStop(work.route), work.stop);
      send(source, work);
      return { ok: true };
    }
    if (work.route.kind === "tow" && work.towed) {
      // Paid only for the car that came along on the flatbed.
      if (
        !DoesEntityExist(work.towed) ||
        !work.vehicle ||
        distance(entityCoords(work.towed), entityCoords(work.vehicle)) >
          TOW_REACH
      )
        return fail("JOBS_ERR_TOW_LOST");
      DeleteEntity(work.towed);
      work.towed = 0;
      work.loaded = false;
    }
    if (work.route.kind === "gather" && work.route.item) {
      const { gatherMin, gatherMax } = work.route;
      const count =
        gatherMin + Math.floor(Math.random() * (gatherMax - gatherMin + 1));
      if (!inventory.addItem(source, work.route.item, count))
        return fail("JOBS_ERR_SPACE");
    } else if (work.route.pay > 0) {
      core.AddMoney(
        source,
        work.route.account,
        work.route.pay,
        `work:${work.route.id}`,
      );
      notify(source, Locale("JOBS_PAID", work.route.pay), "success", 2500);
    }
    work.done++;
    aiLog("work", `stop ${stopId}`, {
      source,
      metadata: { route: work.route.id },
    });
    if (work.route.stops > 0 && work.done >= work.route.stops) {
      notify(source, Locale("JOBS_SHIFT_DONE"), "success");
      end(source);
      return { ok: true };
    }
    const next = nextStop(work.route, work);
    if (!next) {
      end(source);
      return { ok: true };
    }
    const from = work.stop;
    work.index = next.index;
    if (work.route.kind === "tow") {
      const towed = await spawnTowed(work.route, next.stop);
      // Dropped or ended meanwhile: the car has no shift to belong to.
      if (shifts.get(source) !== work) {
        if (towed && DoesEntityExist(towed)) DeleteEntity(towed);
        return { ok: true };
      }
      work.towed = towed;
    }
    assign(work, next.stop, from);
    send(source, work);
    return { ok: true };
  },
);

on("onResourceStop", (resource: string) => {
  if (resource !== ResourceName) return;
  for (const work of shifts.values()) removeEntities(work);
});
