import {
  cache,
  controls,
  every,
  keyHints,
  player,
  requestModel,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";

const PUSH_ANIM = { dict: "missfinale_c2ig_11", clip: "pushcar_offcliff_f" };
const COOK_ANIM = { dict: "amb@prop_human_bbq@male@idle_a", clip: "idle_b" };
/** M (interaction menu) and F (enter vehicle) are off while pushing, as in qb-hotdogjob. */
const PUSH_BLOCKED = [244, 23];

const playPush = () =>
  player.playAnim(PUSH_ANIM.dict, PUSH_ANIM.clip, {
    blendIn: 8,
    blendOut: 8,
    flag: 50,
  });

/**
 * Pushing the own stand (qb-hotdogjob): the push animation kept running, M and F blocked, the let-go key as a hint;
 * `letGo` runs when the player falls, dies, aims, fights or ends up in a vehicle.
 */
export class Pusher {
  pushing = false;
  private readonly job = every(500, () => this.tick(), {
    active: false,
    name: "hotdogPush",
  });

  constructor(private readonly letGo: () => void) {}

  start(): void {
    this.pushing = true;
    controls.disable("hotdog", PUSH_BLOCKED);
    keyHints.show("hotdog_release", {
      label: Locale("HOTDOG_HINT_RELEASE"),
      keybind: "jobs_hotdog_release",
      icon: "hand-pointer",
    });
    void playPush();
    this.job.set(true);
  }

  stop(): void {
    if (!this.pushing) return;
    this.pushing = false;
    this.job.set(false);
    controls.enable("hotdog");
    keyHints.hide("hotdog_release");
    player.stopAnim();
  }

  private tick(): void {
    const ped = cache.ped;
    if (
      IsPedRagdoll(ped) ||
      IsPedDeadOrDying(ped, true) ||
      IsPlayerFreeAiming(cache.playerId) ||
      IsPedInMeleeCombat(ped) ||
      cache.vehicle !== false
    )
      return this.letGo();
    if (!IsEntityPlayingAnim(ped, PUSH_ANIM.dict, PUSH_ANIM.clip, 3))
      void playPush();
  }
}

/** qb-hotdogjob's cooking: the barbecue animation with a spatula while the server runs the skill checks. */
export class Cook {
  private spatula = 0;

  async set(on: boolean): Promise<void> {
    if (this.spatula) DeleteObject(this.spatula);
    this.spatula = 0;
    if (!on) return player.stopAnim();
    await player.playAnim(COOK_ANIM.dict, COOK_ANIM.clip, { flag: 49 });
    const model = await requestModel("prop_fish_slice_01").catch(() => 0);
    if (!model) return;
    const ped = cache.ped;
    this.spatula = CreateObject(model, 0, 0, 0, false, false, false);
    AttachEntityToEntity(
      this.spatula,
      ped,
      GetPedBoneIndex(ped, 57005),
      0.08,
      0,
      -0.02,
      0,
      -25,
      130,
      true,
      true,
      false,
      true,
      1,
      true,
    );
    SetModelAsNoLongerNeeded(model);
  }
}
