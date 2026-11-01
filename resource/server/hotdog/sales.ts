import {
  aiLog,
  Cooldowns,
  entityCoords,
  KeyedCooldowns,
  notify,
  onClientCallback,
  onClientEvent,
  pedFromNet,
  resourceExport,
} from "@aicore-fivem/lib/server";
import {
  distance,
  fail,
  oneArg,
  pickRandom,
  randomInt,
  readId,
} from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { HOTDOG_EVENTS, QUALITIES } from "common/hotdog";
import { hotdogSettings as settings, shifts } from "./shifts";

/** Selling at the stand: the worker's client brings an NPC over, the server makes the offer and takes the sale. */

const core = resourceExport("ai-core");

/** A customer stands this close to the stand; the seller this close to sell. */
const CUSTOMER_METRES = 6;
const SELLER_METRES = 5;
/** An NPC buys once in this time (qb-hotdogjob's "recent peds"). */
const CUSTOMER_COOLDOWN_MS = 10 * 60_000;
/** An offer is good this long; the next customer comes at least this much later. */
const OFFER_MS = 60_000;
const SALE_GAP_MS = 3000;

const customers = new KeyedCooldowns();
const sales = new Cooldowns();

/** The NPC the client sent stands at the seller's stand and has not bought lately. */
function customerAt(source: number, netId: number) {
  const at = shifts.atStand(source, SELLER_METRES);
  if (typeof at === "string") return at;
  const ped = pedFromNet(netId);
  if (
    !ped ||
    IsPedAPlayer(ped) ||
    distance(entityCoords(ped), at.stand) > CUSTOMER_METRES ||
    !customers.ready(netId)
  )
    return "HOTDOG_ERR_CUSTOMER";
  return at;
}

/** QB's offer: a random quality in stock, 1 to 3 of it, a price per hot dog from the level's range. */
onClientCallback(
  HOTDOG_EVENTS.offer,
  { args: oneArg(readId) },
  (source, netId) => {
    if (!sales.ready(source)) return fail("HOTDOG_ERR_CUSTOMER");
    const at = customerAt(source, netId);
    if (typeof at === "string") return fail(at);
    const { shift } = at;
    const have = QUALITIES.filter((q) => shift.stock[q] > 0);
    const quality = pickRandom(have);
    if (!quality) return fail("HOTDOG_ERR_NO_DOGS");
    const range = shifts.levelOf(shift).level?.prices[quality];
    const count = randomInt(1, Math.min(3, shift.stock[quality]));
    const price = range ? randomInt(range.min, range.max) : 1;
    const until = GetGameTimer() + OFFER_MS;
    shift.offer = { netId, quality, count, price, until };
    return { ok: true, count, price: count * price };
  },
);

onClientCallback(
  HOTDOG_EVENTS.sell,
  { args: oneArg(readId), lock: true },
  (source, netId) => {
    const at = customerAt(source, netId);
    if (typeof at === "string") return fail(at);
    const { shift } = at;
    const offer = shift.offer;
    shift.offer = null;
    if (!offer || offer.netId !== netId || GetGameTimer() > offer.until)
      return fail("HOTDOG_ERR_CUSTOMER");
    if (shift.stock[offer.quality] < offer.count)
      return fail("HOTDOG_ERR_NO_DOGS");
    shift.stock[offer.quality] -= offer.count;
    customers.start(netId, CUSTOMER_COOLDOWN_MS);
    sales.start(source, SALE_GAP_MS);
    const total = offer.count * offer.price;
    core.AddMoney(source, settings.value.payAccount, total, "hotdog:sale");
    shifts.send(source, shift);
    notify(source, Locale("HOTDOG_SOLD", offer.count, total), "success");
    aiLog("hotdog", `sold ${offer.count} hot dogs for $${total}`, {
      source,
      metadata: { quality: offer.quality, count: offer.count, total },
    });
    return { ok: true };
  },
);

onClientEvent(HOTDOG_EVENTS.decline, (source) => {
  const shift = shifts.get(source);
  if (!shift?.offer) return;
  customers.start(shift.offer.netId, CUSTOMER_COOLDOWN_MS);
  shift.offer = null;
});
