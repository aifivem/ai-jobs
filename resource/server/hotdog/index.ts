import {
  coordsOf,
  every,
  isNear,
  isOnline,
  minigameFor,
  notify,
  onCharacter,
  onClientCallback,
  online,
  onStop,
  resourceExport,
} from "@aicore-fivem/lib/server";
import {
  distance,
  fail,
  randomInt,
  readFinite,
  rollChance,
} from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { HOTDOG_EVENTS, type Quality } from "common/hotdog";
import { hotdogSettings as settings, shifts } from "./shifts";
import { FOLLOW_MS, stands } from "./stands";
// The NPC sale callbacks (offer, sell, decline) the client calls.
import "./sales";

/** The hot dog stand (qb-hotdogjob): rent at the counter, push it, cook in skill checks; selling in `sales.ts`. */

const core = resourceExport("ai-core");

every(FOLLOW_MS, () => stands.follow(), { name: "hotdogFollow" });
onCharacter({
  loaded: (source) => stands.start(source),
  unloaded: (source) => stands.stop(source),
});
// A character switch ends the shift without the deposit (QB: the stand is gone).
onCharacter({ unloaded: (source) => shifts.end(source, false) });
// A restart gives every deposit back: the stands go with the resource.
onStop(() => shifts.endAll());

const QUALITY_TEXT = {
  exotic: "HOTDOG_Q_EXOTIC",
  rare: "HOTDOG_Q_RARE",
  common: "HOTDOG_Q_COMMON",
} as const;

onClientCallback(
  HOTDOG_EVENTS.start,
  (source) => {
    const s = settings.value;
    if (!s.enabled) return fail("HOTDOG_ERR_OFF");
    if (shifts.get(source)) return fail("HOTDOG_ERR_WORKING");
    if (!isNear(source, s.coords, 4)) return fail("HOTDOG_ERR_FAR");
    if (!online.allows(source, s.access)) return fail("HOTDOG_ERR_JOB");
    if (
      s.deposit > 0 &&
      !core.RemoveMoney(source, s.depositAccount, s.deposit, "hotdog:deposit")
    )
      return fail("HOTDOG_ERR_MONEY");
    shifts.start(source, s.deposit, s.depositAccount);
    if (s.deposit > 0)
      notify(source, Locale("HOTDOG_DEPOSIT_PAID", s.deposit), "success");
    return { ok: true };
  },
  { lock: true },
);

onClientCallback(
  HOTDOG_EVENTS.stop,
  (source) => {
    const shift = shifts.get(source);
    if (!shift) return fail("HOTDOG_ERR_NO_STAND");
    if (!isNear(source, settings.value.coords, 4))
      return fail("HOTDOG_ERR_FAR");
    shifts.end(source, true);
    if (shift.deposit > 0)
      notify(source, Locale("HOTDOG_DEPOSIT_BACK", shift.deposit), "success");
    return { ok: true };
  },
  { lock: true },
);

onClientCallback(HOTDOG_EVENTS.grab, (source) => {
  const at = shifts.atStand(source, 3);
  if (typeof at === "string") return fail(at);
  at.shift.offer = null;
  stands.update(at.stand.id, { pusher: source });
  return { ok: true };
});

onClientCallback(
  HOTDOG_EVENTS.release,
  {
    args: ([x, y, z, h]): [number, number, number, number] | null => {
      const a = readFinite(x);
      const b = readFinite(y);
      const c = readFinite(z);
      const d = readFinite(h);
      return a === null || b === null || c === null || d === null
        ? null
        : [a, b, c, d];
    },
  },
  (source, x, y, z, heading) => {
    const shift = shifts.get(source);
    const stand = shift ? stands.get(shift.stand) : undefined;
    if (!shift || !stand || stand.pusher !== source)
      return fail("HOTDOG_ERR_NO_STAND");
    // The client's spot of its stand copy, unless it is not where the pusher stands.
    const ped = coordsOf(source);
    const at = distance(ped, { x, y, z }) <= 4 ? { x, y, z } : ped;
    stands.update(stand.id, { ...at, heading, pusher: 0 });
    return { ok: true };
  },
);

/** Fastest real play of one easy skill check stage (its green arc starts at 100 degrees, 216 deg/s). */
const COOK_MIN_MS = 400;

/** Skill checks on the worker's client; fewer misses make a better hot dog (qb-hotdogjob's faults). */
async function cook(source: number): Promise<number> {
  let misses = 0;
  for (let i = 0; i < settings.value.checks; i++) {
    const outcome = await minigameFor(source, {
      game: "skillCheck",
      difficulty: "easy",
      rounds: 1,
      keys: ["w", "a", "s", "d"],
      minMs: COOK_MIN_MS,
    });
    if (outcome !== "won") misses++;
  }
  return misses;
}

onClientCallback(
  HOTDOG_EVENTS.prepare,
  async (source) => {
    const at = shifts.atStand(source, 3);
    if (typeof at === "string") return fail(at);
    const { shift } = at;
    emitNet(HOTDOG_EVENTS.cooking, source, true);
    const misses = await cook(source);
    if (!isOnline(source)) return { ok: true };
    emitNet(HOTDOG_EVENTS.cooking, source, false);
    if (shifts.get(source) !== shift) return { ok: true };
    const quality: Quality =
      misses === 0 ? "exotic" : misses === 1 ? "rare" : "common";
    const label = Locale(QUALITY_TEXT[quality]);
    const { index, level } = shifts.levelOf(shift);
    const max = level?.stock ?? 0;
    if (shift.stock[quality] + 1 > max) {
      notify(source, Locale("HOTDOG_NO_MORE", label), "error");
      return { ok: true };
    }
    // From level 2 on, half the time a lucky batch of 1 to the level's number (qb-hotdogjob).
    const made = index > 0 && rollChance(50) ? randomInt(1, index + 1) : 1;
    shift.stock[quality] = Math.min(max, shift.stock[quality] + made);
    shifts.addRep(source, shift, settings.value.repGain[quality]);
    shifts.send(source, shift);
    notify(
      source,
      made > 1
        ? Locale("HOTDOG_MADE_LUCKY", made, label)
        : Locale("HOTDOG_MADE", label),
      "success",
    );
    return { ok: true };
  },
  { lock: true },
);
