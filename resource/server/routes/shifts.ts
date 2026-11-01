import {
  coordsOf,
  entityCoords,
  PlayerMap,
  spawnVehicle,
} from "@aicore-fivem/lib/server";
import {
  distance,
  fail,
  pickRandom,
  type Vec3,
} from "@aicore-fivem/lib/shared";
import type { ActionResult } from "@aicore-fivem/shared";
import { EVENTS, type Route, type Shift, type Stop } from "common/routes";
import { stops } from "./stops";

/** Fastest plausible travel between stops (m/s, ~216 km/h): a stop reached sooner was teleported to. */
const MAX_SPEED = 60;

/**
 * A running shift: route, current stop (server picks it), progress, the work vehicle and when the stop began; tow
 * routes also keep the broken-down car waiting at the stop and whether it is on the flatbed.
 */
export interface Work {
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

export async function spawnTowed(route: Route, stop: Stop): Promise<number> {
  const model = pickRandom(route.towModels) ?? "asea";
  const car = await spawnVehicle({
    model,
    type: "automobile",
    coords: { x: stop.x, y: stop.y, z: stop.z, heading: Math.random() * 360 },
    locked: true,
  });
  return car ?? 0;
}

/** Deletes a shift's work vehicle and towed car. */
export function removeEntities(work: Work): void {
  for (const entity of [work.vehicle, work.towed])
    if (entity && DoesEntityExist(entity)) DeleteEntity(entity);
}

/** Hands out a stop: the stop's bar may start once the way there at `MAX_SPEED` has passed (teleports). */
export function assign(work: Work, stop: Stop, from: Vec3): void {
  work.stop = stop;
  work.since = GetGameTimer();
  work.minMs = (distance(from, stop) / MAX_SPEED) * 1000;
}

/** The checks before and after a stop's bar: still this stop, close to it and (driving) to the work vehicle. */
export function stopRefusal(
  source: number,
  work: Work,
  stopId: string,
): ActionResult | null {
  if (shifts.get(source) !== work || work.stop.id !== stopId)
    return fail("JOBS_ERR_GONE");
  const p = coordsOf(source);
  if (distance(p, work.stop) > 12) return fail("JOBS_ERR_FAR");
  if (
    work.route.kind !== "gather" &&
    work.vehicle &&
    (!DoesEntityExist(work.vehicle) ||
      distance(entityCoords(work.vehicle), p) > 15)
  )
    return fail("JOBS_ERR_VEHICLE_FAR");
  return null;
}

export const depotStop = (route: Route): Stop => ({
  id: "depot",
  route: route.id,
  label: route.label,
  ...route.depot,
});
export const shifts = new PlayerMap<Work>({
  onDrop: (_source, work) => removeEntities(work),
});

export function nextStop(
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
  const stop = pickRandom(choices);
  return stop ? { stop, index: list.indexOf(stop) } : null;
}

export function send(source: number, work: Work | null): void {
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

export function end(source: number): void {
  const work = shifts.get(source);
  shifts.delete(source);
  if (work) removeEntities(work);
  send(source, null);
}
