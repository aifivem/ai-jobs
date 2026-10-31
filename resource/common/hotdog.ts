import {
  type AccessRule,
  bool,
  int,
  num,
  type PlacePed,
  readAccess,
  readBlipStyle,
  readPlacePed,
  record,
  str,
  vec4,
  type Vec4,
} from "@aicore-fivem/lib/shared";

/** The hot dog stand (port of qb-hotdogjob): contracts and panel content. No natives. */

export const HOTDOG_EVENTS = {
  /** Callback: () -> { ok } pay the deposit, the stand appears at the spawn spot. */
  start: "ai-jobs:hotdog:start",
  /** Callback: () -> { ok } stop at the counter: the stand goes, the deposit comes back. */
  stop: "ai-jobs:hotdog:stop",
  /** Callback: () -> { ok } take the stand's handle and push it. */
  grab: "ai-jobs:hotdog:grab",
  /** Callback: (x, y, z, heading) -> { ok } let go of the stand where it stands now. */
  release: "ai-jobs:hotdog:release",
  /** Callback: () -> { ok } prepare hot dogs (skill checks; fewer misses, better quality). */
  prepare: "ai-jobs:hotdog:prepare",
  /** Callback: (pedNetId) -> { ok, count, price } a customer reached the stand: what they want to buy. */
  offer: "ai-jobs:hotdog:offer",
  /** Callback: (pedNetId) -> { ok } sell the offered hot dogs. */
  sell: "ai-jobs:hotdog:sell",
  /** Client event: () the customer left without buying. */
  decline: "ai-jobs:hotdog:decline",
  /** Server -> followers: (reset, puts: StandView[], removes: number[]) stands around the player. */
  stands: "ai-jobs:client:hotdogStands",
  /** Server -> worker: (shift: HotdogView | null) stock and level changed, or the shift ended. */
  shift: "ai-jobs:client:hotdogShift",
  /** Server -> worker: (on: boolean) the cooking animation while the skill checks run. */
  cooking: "ai-jobs:client:hotdogCooking",
} as const;

export const QUALITIES = ["exotic", "rare", "common"] as const;
export type Quality = (typeof QUALITIES)[number];

/** A reputation level: from `rep` on, the stand holds `stock` of each quality and sells at these prices. */
export interface HotdogLevel {
  rep: number;
  stock: number;
  prices: Record<Quality, { min: number; max: number }>;
}

export interface HotdogSettings {
  enabled: boolean;
  /** Who may rent the stand (lib access fields; empty: anyone). */
  access: AccessRule;
  /** The counter where the stand is rented and given back. */
  coords: { x: number; y: number; z: number };
  ped: PlacePed | null;
  blip: { sprite: number; color: number; scale: number };
  /** Where the stand appears, facing `heading`. */
  spawn: Vec4;
  model: string;
  deposit: number;
  depositAccount: string;
  payAccount: string;
  /** Skill checks per preparation: no miss = exotic, one = rare, more = common. */
  checks: number;
  repGain: Record<Quality, number>;
  maxRep: number;
  /** Sorted by `rep`; the first applies from 0. */
  levels: HotdogLevel[];
}

/** qb-hotdogjob's levels (rep 0 / 50 / 100 / 200) with its stock limits and prices. */
const QB_LEVELS: HotdogLevel[] = [
  [0, 15, 8, 12, 6, 9, 4, 6],
  [50, 30, 9, 13, 7, 10, 5, 7],
  [100, 45, 10, 14, 8, 11, 6, 9],
  [200, 60, 11, 15, 9, 12, 7, 9],
].map(([rep = 0, stock = 0, a = 0, b = 0, c = 0, d = 0, e = 0, f = 0]) => ({
  rep,
  stock,
  prices: {
    exotic: { min: a, max: b },
    rare: { min: c, max: d },
    common: { min: e, max: f },
  },
}));

function readLevel(v: Record<string, unknown>): HotdogLevel {
  const range = (q: Quality) => {
    const min = int(v[`${q}Min`], 1, 0, 10_000);
    return { min, max: Math.max(min, int(v[`${q}Max`], min, 0, 10_000)) };
  };
  return {
    rep: int(v.rep, 0, 0, 100_000),
    stock: int(v.stock, 15, 1, 1000),
    prices: {
      exotic: range("exotic"),
      rare: range("rare"),
      common: range("common"),
    },
  };
}

export function readHotdog(raw: unknown): HotdogSettings {
  const v = record(raw);
  const c = record(v.coords);
  const coords = { x: num(c.x, 0), y: num(c.y, 0), z: num(c.z, 0) };
  const levels = Array.isArray(v.levels)
    ? v.levels.map((row) => readLevel(record(row)))
    : [];
  const gain = record(v.repGain);
  return {
    enabled: bool(v.enabled, true),
    access: readAccess(v),
    coords,
    ped: readPlacePed(v.ped),
    blip: readBlipStyle(v.blip, { sprite: 542, color: 17, scale: 0.6 }),
    spawn: vec4(v.spawn, { ...coords, heading: 0 }),
    model: str(v.model, "prop_hotdogstand_01", 64),
    deposit: int(v.deposit, 250, 0, 1_000_000),
    depositAccount: str(v.depositAccount, "bank", 32),
    payAccount: str(v.payAccount, "cash", 32),
    checks: int(v.checks, 3, 1, 10),
    repGain: {
      exotic: int(gain.exotic, 3, 0, 100),
      rare: int(gain.rare, 2, 0, 100),
      common: int(gain.common, 1, 0, 100),
    },
    maxRep: int(v.maxRep, 200, 0, 100_000),
    levels: (levels.length ? levels : QB_LEVELS).sort((a, b) => a.rep - b.rep),
  };
}

/** The level a reputation reaches (index into `levels`). */
export function levelOf(levels: HotdogLevel[], rep: number): number {
  let level = 0;
  for (let i = 0; i < levels.length; i++)
    if (rep >= (levels[i]?.rep ?? 0)) level = i;
  return level;
}

/** A stand as every client around it gets it; `pusher` is the server id pushing it (0: standing). */
export interface StandView {
  id: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  owner: number;
  pusher: number;
}

/** The worker's shift: stock per quality, the limit of the level, reputation. */
export interface HotdogView {
  stand: number;
  stock: Record<Quality, number>;
  max: number;
  level: number;
  rep: number;
}

export function toStandView(v: unknown): StandView | null {
  const r = record(v);
  return typeof r.id === "number" &&
    typeof r.x === "number" &&
    typeof r.y === "number" &&
    typeof r.z === "number"
    ? {
        id: r.id,
        x: r.x,
        y: r.y,
        z: r.z,
        heading: num(r.heading, 0),
        owner: int(r.owner, 0, 0),
        pusher: int(r.pusher, 0, 0),
      }
    : null;
}

export function toHotdogView(v: unknown): HotdogView | null {
  const r = record(v);
  const s = record(r.stock);
  if (typeof r.stand !== "number") return null;
  return {
    stand: r.stand,
    stock: {
      exotic: int(s.exotic, 0, 0),
      rare: int(s.rare, 0, 0),
      common: int(s.common, 0, 0),
    },
    max: int(r.max, 0, 0),
    level: int(r.level, 0, 0),
    rep: int(r.rep, 0, 0),
  };
}
