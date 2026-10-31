import {
  type AccessRule,
  int,
  num,
  type PlacePed,
  readBlipStyle,
  readId,
  readAccess,
  readPlacePed,
  record,
  str,
  vec4,
  type Vec4,
} from "@aicore-fivem/lib/shared";

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
  /** Who may work the route (lib access fields; empty: anyone). */
  access: AccessRule;
  depot: { x: number; y: number; z: number };
  /** Empty for gather routes. */
  vehicle: string;
  spawn: Vec4;
  /** Dollars per stop (vehicle routes). */
  pay: number;
  /** The money account the pay goes to. */
  account: string;
  /** Seconds the stop takes. */
  seconds: number;
  /** Item per stop (gather routes). */
  item: string;
  /** Stops in one shift (0 = endless). */
  stops: number;
  /** Items per gather stop, a random count from `gatherMin` to `gatherMax`. */
  gatherMin: number;
  gatherMax: number;
  /** Cars a tow route finds broken down at its stops. */
  towModels: string[];
  /** The depot's map blip. */
  blip: { sprite: number; color: number; scale: number };
}

export const DEFAULT_TOW_MODELS = [
  "asea",
  "premier",
  "emperor",
  "blista",
  "ingot",
  "stanier",
  "washington",
  "oracle",
];

/** Depot blip per route kind when the record has no blip of its own. */
const KIND_SPRITE: Record<RouteKind, number> = {
  ordered: 67,
  random: 67,
  gather: 478,
  tow: 68,
};

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

/** One route record (`panel.records` / `world.records`). */
export function readRoute(id: string, v: Record<string, unknown>): Route {
  const d = record(v.depot);
  const kind = KINDS.includes(v.kind as RouteKind)
    ? (v.kind as RouteKind)
    : "random";
  const gatherMin = int(v.gatherMin, 1, 1, 100);
  const towModels = Array.isArray(v.towModels)
    ? v.towModels.filter((m): m is string => typeof m === "string")
    : [];
  const blip = record(v.blip);
  return {
    ped: readPlacePed(v.ped),
    id,
    label: str(v.label, id, 48),
    kind,
    access: readAccess(v),
    depot: { x: num(d.x, 0), y: num(d.y, 0), z: num(d.z, 0) },
    vehicle: str(v.vehicle, "", 32),
    spawn: vec4(v.spawn, {
      x: num(d.x, 0),
      y: num(d.y, 0),
      z: num(d.z, 0),
      heading: 0,
    }),
    pay: int(v.pay, 0, 0, 100_000),
    account: str(v.account, "bank", 32) || "bank",
    seconds: int(v.seconds, 5, 0, 120),
    item: str(v.item, "", 48),
    stops: int(v.stops, 0, 0, 100),
    gatherMin,
    gatherMax: Math.max(gatherMin, int(v.gatherMax, 3, 1, 100)),
    towModels: towModels.length ? towModels : DEFAULT_TOW_MODELS,
    blip: readBlipStyle(blip, {
      sprite: KIND_SPRITE[kind],
      color: 5,
      scale: 0.65,
    }),
  };
}

/** One stop record (`panel.records`); a stop without a route is left out. */
export function readStop(id: string, v: Record<string, unknown>): Stop | null {
  const c = record(v.coords);
  const route = str(v.route, "", 32);
  if (route === "") return null;
  return {
    id,
    route,
    label: str(v.label, id, 48),
    x: num(c.x, 0),
    y: num(c.y, 0),
    z: num(c.z, 0),
  };
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
    netId: readId(s.netId),
  };
}
