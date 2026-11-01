import {
  isNear,
  isOnline,
  onClientCallback,
  online,
  onStop,
  spawnVehicle,
} from "@aicore-fivem/lib/server";
import {
  fail,
  oneArg,
  readText,
  RecordObjects,
} from "@aicore-fivem/lib/shared";
import { readRoute, readStop, EVENTS } from "common/routes";
import { panel } from "../content";
import { arrive } from "./arrive";
import {
  assign,
  end,
  nextStop,
  removeEntities,
  send,
  shifts,
  spawnTowed,
  type Work,
} from "./shifts";
import { stops } from "./stops";

const routes = panel.records("routes", readRoute);
new RecordObjects(panel, "stops", readStop, (_id, stop) => stops.add(stop));
const readTextId = oneArg((v) => readText(v, 64));

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
  {
    args: ([id, underwater]): [string, boolean] | null => {
      const stopId = readText(id, 64);
      return stopId === null ? null : [stopId, underwater === true];
    },
    lock: true,
  },
  (source, stopId, underwater) => arrive(source, stopId, underwater),
);

onStop(() => {
  for (const work of shifts.values()) removeEntities(work);
});
