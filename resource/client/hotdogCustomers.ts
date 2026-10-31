import {
  cache,
  callAction,
  every,
  notify,
  player,
  Points,
  requestModel,
} from "@aicore-fivem/lib/client";
import { nearestOf, num } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { HOTDOG_EVENTS } from "common/hotdog";

/** qb-hotdogjob's numbers: customers come from 15 m, stop 2 m from the stand's front, the seller stays within 10 m. */
const FIND_METRES = 15;
const ARRIVE_METRES = 2;
const SELLER_METRES = 10;
/** A customer who got no answer leaves after this. */
const WAIT_MS = 30_000;

/**
 * While selling: the closest free NPC walks up to the stand's front, the server makes the offer, a point on the
 * customer sells it. Only NPCs this client controls are asked (no control requests under the server's lockdown).
 */
export class Customers {
  private ped = 0;
  private netId = 0;
  private arrivedAt = 0;
  private readonly recent = new Set<number>();
  private readonly point = new Points();
  private readonly job = every(500, () => void this.tick(), {
    active: false,
    name: "hotdogCustomers",
  });

  /** `stand` is the stand's object (0 while not drawn); `quit` ends selling (seller walked off, stock gone). */
  constructor(
    private readonly stand: () => number,
    private readonly hasStock: () => boolean,
    private readonly quit: (
      reason: "HOTDOG_ERR_FAR" | "HOTDOG_ERR_NO_DOGS",
    ) => void,
  ) {}

  start(): void {
    this.job.set(true);
  }

  stop(): void {
    this.job.set(false);
    this.leave(this.arrivedAt > 0);
  }

  private front(object: number): [number, number, number] {
    const [x = 0, y = 0, z = 0] = GetOffsetFromEntityInWorldCoords(
      object,
      0,
      -0.8,
      0,
    );
    return [x, y, z];
  }

  private async tick(): Promise<void> {
    const object = this.stand();
    if (!object) return;
    const [sx, sy, sz] = GetEntityCoords(object, false);
    if (
      player.distanceTo({ x: sx ?? 0, y: sy ?? 0, z: sz ?? 0 }) > SELLER_METRES
    )
      return this.quit("HOTDOG_ERR_FAR");
    if (this.ped && !DoesEntityExist(this.ped)) this.leave(false);
    if (!this.ped) {
      if (!this.hasStock()) return this.quit("HOTDOG_ERR_NO_DOGS");
      return this.find(object);
    }
    if (this.arrivedAt) {
      if (GetGameTimer() - this.arrivedAt > WAIT_MS) {
        notify(Locale("HOTDOG_CUSTOMER_LEFT"), "info", 2500);
        this.leave(true);
      }
      return;
    }
    const [fx, fy, fz] = this.front(object);
    const [px = 0, py = 0, pz = 0] = GetEntityCoords(this.ped, false);
    if (Math.hypot(px - fx, py - fy, pz - fz) > ARRIVE_METRES)
      return void TaskGoStraightToCoord(this.ped, fx, fy, fz, 1.2, -1, 0, 0);
    await this.arrive();
  }

  private find(object: number): void {
    const [x = 0, y = 0, z = 0] = GetEntityCoords(object, false);
    const best = nearestOf(
      (GetGamePool("CPed") as number[]).filter(
        (ped) =>
          ped !== cache.ped &&
          !IsPedAPlayer(ped) &&
          !IsPedDeadOrDying(ped, true) &&
          !IsPedInAnyVehicle(ped, false) &&
          IsPedHuman(ped) &&
          NetworkGetEntityIsNetworked(ped) &&
          NetworkHasControlOfEntity(ped) &&
          !this.recent.has(PedToNet(ped)),
      ),
      { x, y, z },
      (ped) => {
        const [px = 0, py = 0, pz = 0] = GetEntityCoords(ped, false);
        return { x: px, y: py, z: pz };
      },
      FIND_METRES,
    );
    if (!best) return;
    this.ped = best;
    this.netId = PedToNet(best);
    ClearPedTasks(best);
    const [fx, fy, fz] = this.front(object);
    TaskGoStraightToCoord(best, fx, fy, fz, 1.2, -1, 0, 0);
  }

  private async arrive(): Promise<void> {
    const ped = this.ped;
    this.arrivedAt = GetGameTimer();
    FreezeEntityPosition(ped, true);
    TaskTurnPedToFaceEntity(ped, cache.ped, 5500);
    TaskStartScenarioInPlace(
      ped,
      "WORLD_HUMAN_STAND_IMPATIENT_UPRIGHT",
      0,
      false,
    );
    const offer = await callAction(HOTDOG_EVENTS.offer, [this.netId], {
      fallback: "HOTDOG_ERR_CUSTOMER",
    });
    if (this.ped !== ped) return;
    if (!offer) return this.leave(false);
    const [x = 0, y = 0, z = 0] = GetEntityCoords(ped, false);
    this.point.add("customer", {
      coords: { x, y, z },
      label: Locale(
        "HOTDOG_PROMPT_CUSTOMER",
        num(offer.count, 1),
        num(offer.price, 0),
      ),
      icon: "money-bill-wave",
      radius: 2,
      onPressed: () => this.sell(),
    });
  }

  private async sell(): Promise<void> {
    const sold = await callAction(HOTDOG_EVENTS.sell, [this.netId], {
      fallback: "HOTDOG_ERR_CUSTOMER",
    });
    this.point.clear();
    if (sold) void this.hand();
    this.leave(false);
  }

  /** qb-hotdogjob's hand-over: the give animation with a hot dog in the hand. */
  private async hand(): Promise<void> {
    const model = await requestModel("prop_cs_hotdog_01").catch(() => 0);
    const ped = cache.ped;
    let prop = 0;
    if (model) {
      prop = CreateObject(model, 0, 0, 0, false, false, false);
      AttachEntityToEntity(
        prop,
        ped,
        GetPedBoneIndex(ped, 57005),
        0.12,
        0,
        -0.05,
        220,
        120,
        0,
        true,
        true,
        false,
        true,
        1,
        true,
      );
      SetModelAsNoLongerNeeded(model);
    }
    await player.playAnim("mp_common", "givetake1_b", {
      duration: 1100,
      flag: 48,
    });
    setTimeout(() => {
      if (prop) DeleteObject(prop);
    }, 1250);
  }

  /** The customer walks off; one who got an offer is told to the server (it will not buy again soon). */
  private leave(declined: boolean): void {
    this.point.clear();
    const ped = this.ped;
    if (ped && DoesEntityExist(ped)) {
      FreezeEntityPosition(ped, false);
      ClearPedTasks(ped);
      SetEntityAsNoLongerNeeded(ped);
    }
    if (this.netId) this.recent.add(this.netId);
    if (declined) emitNet(HOTDOG_EVENTS.decline);
    this.ped = 0;
    this.netId = 0;
    this.arrivedAt = 0;
  }
}
