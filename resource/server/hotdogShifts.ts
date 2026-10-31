import {
  isNear,
  isOnline,
  onCharacter,
  PlayerMap,
  resourceExport,
} from "@aicore-fivem/lib/server";
import { int, record } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import {
  HOTDOG_EVENTS,
  levelOf,
  readHotdog,
  type HotdogView,
  type Quality,
  type StandView,
} from "common/hotdog";
import { panel } from "./content";
import { stands } from "./hotdogStands";

const core = resourceExport("ai-core");

/** The panel's stand settings. */
export const hotdogSettings = panel.view("hotdog", readHotdog);

export interface Offer {
  netId: number;
  quality: Quality;
  count: number;
  price: number;
  until: number;
}

/** A rented stand: deposit, stock per quality, reputation (ai-core metadata `rep.hotdog`, as QB), the open offer. */
export interface Shift {
  stand: number;
  deposit: number;
  account: string;
  rep: number;
  stock: Record<Quality, number>;
  offer: Offer | null;
}

/** Every running hot dog shift (server memory only: a shift ends on leave, character switch or restart). */
class HotdogShifts {
  private readonly map = new PlayerMap<Shift>({
    onDrop: (_source, shift) => stands.remove(shift.stand),
  });

  get(source: number): Shift | undefined {
    return this.map.get(source);
  }

  /** Starts a shift with its stand at the panel's spawn spot (the deposit is already paid). */
  start(source: number, deposit: number, account: string): void {
    const s = hotdogSettings.value;
    const stand = stands.add(source, s.spawn, s.spawn.heading);
    const shift: Shift = {
      stand: stand.id,
      deposit,
      account,
      rep: int(record(core.GetMeta(source, "rep")).hotdog, 0, 0, 1_000_000),
      stock: { exotic: 0, rare: 0, common: 0 },
      offer: null,
    };
    this.map.set(source, shift);
    this.send(source, shift);
  }

  /** Ends the shift: the stand goes; `refund` gives the deposit back. */
  end(source: number, refund: boolean): void {
    const shift = this.map.get(source);
    if (!shift) return;
    this.map.delete(source);
    stands.remove(shift.stand);
    if (refund && shift.deposit > 0)
      core.AddMoney(source, shift.account, shift.deposit, "hotdog:deposit");
    if (isOnline(source)) this.send(source, null);
  }

  endAll(): void {
    for (const source of this.map.keys()) this.end(source, true);
  }

  /** The level the shift's reputation reached (index) and its limits. */
  levelOf(shift: Shift) {
    const { levels } = hotdogSettings.value;
    const index = levelOf(levels, shift.rep);
    return { index, level: levels[index] ?? levels[0] };
  }

  /** Raises the reputation (capped) and stores it in ai-core's metadata. */
  addRep(source: number, shift: Shift, gain: number): void {
    const rep = Math.min(hotdogSettings.value.maxRep, shift.rep + gain);
    if (rep === shift.rep) return;
    shift.rep = rep;
    core.SetMeta(source, "rep", {
      ...record(core.GetMeta(source, "rep")),
      hotdog: rep,
    });
  }

  /** The worker's stock and level (a handful of numbers, sent whole on each change). */
  send(source: number, shift: Shift | null): void {
    let view: HotdogView | null = null;
    if (shift) {
      const { index, level } = this.levelOf(shift);
      view = {
        stand: shift.stand,
        stock: { ...shift.stock },
        max: level?.stock ?? 0,
        level: index + 1,
        rep: shift.rep,
      };
    }
    emitNet(HOTDOG_EVENTS.shift, source, view);
  }

  /** The player's own stand while it stands (not pushed) within `metres`; else the refusal key. */
  atStand(
    source: number,
    metres: number,
  ): { shift: Shift; stand: StandView } | string {
    const shift = this.map.get(source);
    const stand = shift ? stands.get(shift.stand) : undefined;
    if (!shift || !stand) return "HOTDOG_ERR_NO_STAND";
    if (stand.pusher) return "HOTDOG_ERR_PUSHING";
    if (!isNear(source, stand, metres)) return "HOTDOG_ERR_FAR";
    return { shift, stand };
  }
}

export const shifts = new HotdogShifts();
// A character switch ends the shift without the deposit (QB: the stand is gone).
onCharacter({ unloaded: (source) => shifts.end(source, false) });
// A restart gives every deposit back: the stands go with the resource.
on("onResourceStop", (resource: string) => {
  if (resource === ResourceName) shifts.endAll();
});
