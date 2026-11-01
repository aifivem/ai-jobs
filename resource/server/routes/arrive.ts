import {
  aiLog,
  entityCoords,
  inventory,
  notify,
  progressFor,
  resourceExport,
} from "@aicore-fivem/lib/server";
import { distance, fail, randomInt } from "@aicore-fivem/lib/shared";
import type { ActionResult } from "@aicore-fivem/shared";
import { Locale } from "common";
import { EVENTS } from "common/routes";
import {
  assign,
  depotStop,
  end,
  nextStop,
  send,
  shifts,
  spawnTowed,
  stopRefusal,
} from "./shifts";

const core = resourceExport("ai-core");

/** The towed car counts as on the flatbed within this distance of the work vehicle. */
const TOW_REACH = 15;

/** A stop's work: the server-timed bar, then the tow step, pay or items, and the next stop. */
export async function arrive(
  source: number,
  stopId: string,
  underwater: boolean,
): Promise<ActionResult> {
  const work = shifts.get(source);
  if (!work) return fail("JOBS_ERR_GONE");
  const before = stopRefusal(source, work, stopId);
  if (before) return before;
  if (GetGameTimer() - work.since < work.minMs) return fail("JOBS_ERR_FAST");
  const gather = work.route.kind === "gather";
  const done = await progressFor(source, {
    label: Locale("JOBS_WORKING"),
    duration: work.route.seconds * 1000,
    anim:
      gather && !underwater
        ? { dict: "amb@prop_human_bum_bin@base", clip: "base" }
        : undefined,
    allowVehicle: !gather,
  });
  // A cancelled bar ends quietly; the stop stays.
  if (!done) return { ok: true };
  const after = stopRefusal(source, work, stopId);
  if (after) return after;
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
      distance(entityCoords(work.towed), entityCoords(work.vehicle)) > TOW_REACH
    )
      return fail("JOBS_ERR_TOW_LOST");
    DeleteEntity(work.towed);
    work.towed = 0;
    work.loaded = false;
  }
  if (work.route.kind === "gather" && work.route.item) {
    const { gatherMin, gatherMax } = work.route;
    const count = randomInt(gatherMin, gatherMax);
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
}
