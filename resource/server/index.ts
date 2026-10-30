import { AdminPanel, aiLog, aiLogChannels, inventory, notify, onClientCallback, optionalExport, resourceExport } from "@aicore-fivem/lib/server";
import { waitFor } from "@aicore-fivem/lib/shared";
import { Locale, ResourceName } from "common";
import { EVENTS, readRoutes, readStops, type Route, type Shift, type Stop } from "common/routes";
import { jobsSchema } from "./schema";

const core = resourceExport("ai-core");
const panel = new AdminPanel(jobsSchema);
/** Routes and stops, parsed again after every panel change. */
const content = { routes: readRoutes(panel.get("routes")), stops: readStops(panel.get("stops")) };
panel.onChange("routes", () => (content.routes = readRoutes(panel.get("routes"))));
panel.onChange("stops", () => (content.stops = readStops(panel.get("stops"))));
aiLogChannels({ work: { active: false } });

const fail = (error: string) => ({ ok: false as const, error });
const pos = (source: number) => {
  const [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
  return { x, y, z };
};

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
  since: number;
  towed: number;
  loaded: boolean;
}

/** Cars a tow route finds broken down at its stops. */
const TOW_MODELS = ["asea", "premier", "emperor", "blista", "ingot", "stanier", "washington", "oracle"];

async function spawnTowed(stop: Stop): Promise<number> {
  const model = TOW_MODELS[Math.floor(Math.random() * TOW_MODELS.length)] ?? "asea";
  const car = CreateVehicleServerSetter(GetHashKey(model), "automobile", stop.x, stop.y, stop.z, Math.random() * 360);
  if (!(await waitFor(() => DoesEntityExist(car) || undefined, 5000).catch(() => false))) return 0;
  SetVehicleDoorsLocked(car, 2);
  return car;
}

const depotStop = (route: Route): Stop => ({ id: "depot", route: route.id, label: route.label, ...route.depot });
const shifts = new Map<number, Work>();

function nextStop(route: Route, work: Work | null): { stop: Stop; index: number } | null {
  const list = content.stops.filter((s) => s.route === route.id);
  if (list.length === 0) return null;
  if (route.kind === "ordered") {
    const index = work ? (work.index + 1) % list.length : 0;
    const stop = list[index];
    return stop ? { stop, index } : null;
  }
  const choices = list.length > 1 && work ? list.filter((s) => s.id !== work.stop.id) : list;
  const stop = choices[Math.floor(Math.random() * choices.length)];
  return stop ? { stop, index: list.indexOf(stop) } : null;
}

function send(source: number, work: Work | null): void {
  const shift: Shift | null = work
    ? { route: work.route.id, stop: work.stop, done: work.done, total: work.route.stops, netId: work.vehicle ? NetworkGetNetworkIdFromEntity(work.vehicle) : null }
    : null;
  emitNet(EVENTS.shift, source, shift);
}

function end(source: number): void {
  const work = shifts.get(source);
  shifts.delete(source);
  if (work?.vehicle && DoesEntityExist(work.vehicle)) DeleteEntity(work.vehicle);
  if (work?.towed && DoesEntityExist(work.towed)) DeleteEntity(work.towed);
  send(source, null);
}

onClientCallback(EVENTS.start, { args: ([id]) => (typeof id === "string" ? [id] : null), lock: true }, async (source, id) => {
  const route = content.routes.get(id);
  if (!route) return fail("JOBS_ERR_GONE");
  if (shifts.has(source)) return fail("JOBS_ERR_WORKING");
  const p = pos(source);
  if (Math.hypot(p.x - route.depot.x, p.y - route.depot.y, p.z - route.depot.z) > 4) return fail("JOBS_ERR_FAR");
  if (route.job && !(core.GetJobs(source) ?? []).some((m) => m.job === route.job)) return fail("JOBS_ERR_JOB");
  const first = nextStop(route, null);
  if (!first) return fail("JOBS_ERR_NO_STOPS");
  let vehicle: number | null = null;
  if (route.vehicle && route.kind !== "gather") {
    const s = route.spawn;
    vehicle = CreateVehicleServerSetter(GetHashKey(route.vehicle), "automobile", s.x, s.y, s.z, s.heading);
    const ok = await waitFor(() => DoesEntityExist(vehicle ?? 0) || undefined, 5000).catch(() => false);
    if (!ok) return fail("JOBS_ERR_VEHICLE");
    SetVehicleNumberPlateText(vehicle, `WORK${source}`.slice(0, 8));
    optionalExport("ai-vehiclekeys")?.GiveKeys(source, vehicle);
  }
  const towed = route.kind === "tow" ? await spawnTowed(first.stop) : 0;
  shifts.set(source, { route, stop: first.stop, done: 0, vehicle, index: first.index, since: Date.now(), towed, loaded: false });
  send(source, shifts.get(source) ?? null);
  return { ok: true };
});

onClientCallback(EVENTS.stop, (source) => {
  end(source);
  return { ok: true };
});

onClientCallback(EVENTS.arrive, { args: ([stopId]) => (typeof stopId === "string" ? [stopId] : null), lock: true }, async (source, stopId) => {
  const work = shifts.get(source);
  if (!work || work.stop.id !== stopId) return fail("JOBS_ERR_GONE");
  const p = pos(source);
  if (Math.hypot(p.x - work.stop.x, p.y - work.stop.y, p.z - work.stop.z) > 12) return fail("JOBS_ERR_FAR");
  // The stop's own time on the client clock, with a little drift allowed.
  if (Date.now() - work.since < work.route.seconds * 800) return fail("JOBS_ERR_FAST");
  if (work.route.kind !== "gather" && work.vehicle) {
    const [vx = 0, vy = 0, vz = 0] = GetEntityCoords(work.vehicle);
    if (!DoesEntityExist(work.vehicle) || Math.hypot(vx - p.x, vy - p.y, vz - p.z) > 15) return fail("JOBS_ERR_VEHICLE_FAR");
  }
  if (work.route.kind === "tow" && !work.loaded) {
    if (!work.towed || !DoesEntityExist(work.towed) || !work.vehicle) return fail("JOBS_ERR_GONE");
    // Only the owner client of the car can attach it.
    const owner = NetworkGetEntityOwner(work.towed);
    emitNet(EVENTS.attach, owner > 0 ? owner : source, NetworkGetNetworkIdFromEntity(work.towed), NetworkGetNetworkIdFromEntity(work.vehicle));
    work.loaded = true;
    work.stop = depotStop(work.route);
    work.since = Date.now();
    send(source, work);
    return { ok: true };
  }
  if (work.route.kind === "tow" && work.towed) {
    if (DoesEntityExist(work.towed)) DeleteEntity(work.towed);
    work.towed = 0;
    work.loaded = false;
  }
  if (work.route.kind === "gather" && work.route.item) {
    const count = 1 + Math.floor(Math.random() * 3);
    if (!inventory.addItem(source, work.route.item, count)) return fail("JOBS_ERR_SPACE");
  } else if (work.route.pay > 0) {
    core.AddMoney(source, "bank", work.route.pay, `work:${work.route.id}`);
    notify(source, Locale("JOBS_PAID", work.route.pay), "success", 2500);
  }
  work.done++;
  aiLog("work", `stop ${stopId}`, { source, metadata: { route: work.route.id } });
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
  work.stop = next.stop;
  work.index = next.index;
  work.since = Date.now();
  if (work.route.kind === "tow") work.towed = await spawnTowed(next.stop);
  send(source, work);
  return { ok: true };
});

on("playerDropped", () => end(Number(globalThis.source)));
on("onResourceStop", (resource: string) => {
  if (resource !== ResourceName) return;
  for (const work of shifts.values()) for (const entity of [work.vehicle, work.towed]) if (entity && DoesEntityExist(entity)) DeleteEntity(entity);
});
