import { int, num, record, str, vec4, type Vec4, readPlacePed, type PlacePed } from "@aicore-fivem/lib/shared";

/** ai-jobs' contracts and panel content. No natives. */

/**
 * ordered: stops in their order (bus); random: a random next stop (taxi, trucker, garbage, news); gather: on foot,
 * items per stop; tow: a broken-down car waits at a random stop, goes on the flatbed and is paid at the depot.
 */
export type RouteKind = "ordered" | "random" | "gather" | "tow";

export const EVENTS = {
  /** Callback: (routeId) -> { ok } start working at the depot (spawns the work vehicle). */
  start: "ai-jobs:start",
  /** Callback: () -> { ok } stop working (the vehicle goes). */
  stop: "ai-jobs:stop",
  /** Callback: (stopId) -> { ok } the player finished the current stop (after the progress). */
  arrive: "ai-jobs:arrive",
  /** Server -> worker: (shift: Shift | null) the current stop (or the shift ended). */
  shift: "ai-jobs:client:shift",
  /** Server -> the towed car's owner: (carNetId, flatbedNetId) attach the car to the flatbed. */
  attach: "ai-jobs:client:attach",
} as const;

export interface Route {
  /** NPC standing at the place (panel), null for none. */
  ped: PlacePed | null;
  id: string;
  label: string;
  kind: RouteKind;
  /** Empty: anyone; otherwise this ai-core job. */
  job: string;
  depot: { x: number; y: number; z: number };
  /** Empty for gather routes. */
  vehicle: string;
  spawn: Vec4;
  /** Dollars per stop (vehicle routes). */
  pay: number;
  /** Seconds the stop takes. */
  seconds: number;
  /** Item per stop (gather routes). */
  item: string;
  /** Stops in one shift (0 = endless). */
  stops: number;
}

export interface Stop {
  id: string;
  route: string;
  label: string;
  x: number;
  y: number;
  z: number;
}

export interface Shift {
  route: string;
  stop: Stop;
  done: number;
  total: number;
  netId: number | null;
}

const KINDS: RouteKind[] = ["ordered", "random", "gather", "tow"];

export function readRoutes(raw: unknown): Map<string, Route> {
  const out = new Map<string, Route>();
  for (const [id, value] of Object.entries(record(raw))) {
    const v = record(value);
    const d = record(v.depot);
    out.set(id, {
      ped: readPlacePed(v.ped),
      id,
      label: str(v.label, id, 48),
      kind: KINDS.includes(v.kind as RouteKind)
        ? (v.kind as RouteKind)
        : "random",
      job: str(v.job, "", 32),
      depot: { x: num(d.x, 0), y: num(d.y, 0), z: num(d.z, 0) },
      vehicle: str(v.vehicle, "", 32),
      spawn: vec4(v.spawn, {
        x: num(d.x, 0),
        y: num(d.y, 0),
        z: num(d.z, 0),
        heading: 0,
      }),
      pay: int(v.pay, 0, 0, 100_000),
      seconds: int(v.seconds, 5, 0, 120),
      item: str(v.item, "", 48),
      stops: int(v.stops, 0, 0, 100),
    });
  }
  return out;
}

export function readStops(raw: unknown): Stop[] {
  return Object.entries(record(raw))
    .map(([id, value]) => {
      const v = record(value);
      const c = record(v.coords);
      return {
        id,
        route: str(v.route, "", 32),
        label: str(v.label, id, 48),
        x: num(c.x, 0),
        y: num(c.y, 0),
        z: num(c.z, 0),
      };
    })
    .filter((s) => s.route !== "")
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

export function toShift(v: unknown): Shift | null {
  const s = record(v);
  const stop = record(s.stop);
  if (
    typeof s.route !== "string" ||
    typeof stop.id !== "string" ||
    typeof stop.x !== "number" ||
    typeof stop.y !== "number" ||
    typeof stop.z !== "number"
  )
    return null;
  return {
    route: s.route,
    stop: {
      id: stop.id,
      route: s.route,
      label: str(stop.label, stop.id, 48),
      x: stop.x,
      y: stop.y,
      z: stop.z,
    },
    done: int(s.done, 0, 0),
    total: int(s.total, 0, 0),
    netId: typeof s.netId === "number" ? s.netId : null,
  };
}
