import {
  allows,
  cache,
  callAction,
  menu,
  notify,
  player,
  Points,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";
import { HOTDOG_EVENTS, type HotdogView } from "common/hotdog";
import { hotdog } from "../content";
import { Customers } from "./customers";
import { Cook, Pusher } from "./push";
import { stands } from "./stands";

/**
 * The worker's side of the hot dog stand: the counter (rent / give back), one point on the own stand (a menu: push,
 * prepare, selling on or off), pushing (animation, let-go key, letting go when hurt, aiming or fighting) and the
 * cooking animation while the server runs the skill checks.
 */
class HotdogWork {
  private shift: HotdogView | null = null;
  private selling = false;
  private readonly counter = new Points();
  private readonly standPoint = new Points();
  private readonly customers = new Customers(
    () => (this.shift ? (stands.get(this.shift.stand)?.object ?? 0) : 0),
    () => this.stockLeft() > 0,
    (reason) => {
      notify(Locale(reason), "error");
      this.setSelling(false);
    },
  );
  private readonly pusher = new Pusher(() => void this.release());
  readonly cook = new Cook();

  rebuildCounter(): void {
    this.counter.clear();
    const s = hotdog.value;
    if (!s.enabled) return;
    this.counter.add("hotdog", {
      coords: s.coords,
      ped: s.ped ?? undefined,
      blip: { ...s.blip, label: Locale("HOTDOG_BLIP") },
      icon: "store",
      label: () =>
        this.shift
          ? Locale("HOTDOG_PROMPT_RETURN")
          : Locale("HOTDOG_PROMPT_RENT", s.deposit),
      canShow: () => allows(s.access),
      onPressed: () => this.toggleShift(),
    });
  }

  standId(): number | undefined {
    return this.shift?.stand;
  }

  setShift(shift: HotdogView | null): void {
    const had = this.shift?.stand;
    this.shift = shift;
    if (!shift) {
      this.setSelling(false);
      this.pusher.stop();
      void this.cook.set(false);
    }
    if (had !== shift?.stand) this.standChanged();
    this.counter.refresh();
  }

  /** Our stand was drawn again (moved, pushed, let go): its point follows it. */
  standChanged(): void {
    this.standPoint.clear();
    const view = this.shift ? stands.get(this.shift.stand)?.view : undefined;
    if (!view || view.pusher) return;
    this.standPoint.add("stand", {
      coords: view,
      label: Locale("HOTDOG_PROMPT_STAND"),
      icon: "utensils",
      radius: 2.5,
      onPressed: () => this.standMenu(),
    });
  }

  async release(): Promise<void> {
    if (!this.pusher.pushing || !this.shift) return;
    const object = stands.get(this.shift.stand)?.object ?? 0;
    const [x = 0, y = 0, z = 0] = object
      ? GetEntityCoords(object, false)
      : GetEntityCoords(cache.ped, false);
    const heading = object ? GetEntityHeading(object) : player.heading();
    this.pusher.stop();
    await callAction(HOTDOG_EVENTS.release, [x, y, z, heading], {
      fallback: "HOTDOG_ERR_NO_STAND",
    });
  }

  stop(): void {
    this.setSelling(false);
    this.pusher.stop();
    void this.cook.set(false);
  }

  private stockLeft(): number {
    const s = this.shift?.stock;
    return s ? s.exotic + s.rare + s.common : 0;
  }

  private async toggleShift(): Promise<void> {
    const working = this.shift !== null;
    const done = await callAction(
      working ? HOTDOG_EVENTS.stop : HOTDOG_EVENTS.start,
      [],
      { fallback: "HOTDOG_ERR_FAR" },
    );
    if (done && !working) notify(Locale("HOTDOG_STARTED"), "info");
  }

  private async standMenu(): Promise<void> {
    const shift = this.shift;
    if (!shift) return;
    const { stock, max, level } = shift;
    const picked = await menu({
      title: Locale("HOTDOG_MENU_TITLE", level),
      items: [
        { id: "push", label: Locale("HOTDOG_MENU_PUSH"), icon: "hand-pointer" },
        {
          id: "prepare",
          label: Locale("HOTDOG_MENU_PREPARE"),
          description: Locale(
            "HOTDOG_MENU_STOCK",
            stock.exotic,
            stock.rare,
            stock.common,
            max,
          ),
          icon: "utensils",
        },
        {
          id: "sell",
          label: Locale(
            this.selling ? "HOTDOG_MENU_SELL_OFF" : "HOTDOG_MENU_SELL_ON",
          ),
          description: Locale("HOTDOG_MENU_SELL_DESC"),
          icon: this.selling ? "xmark" : "money-bill-wave",
        },
      ],
    });
    if (picked === "push") return this.grab();
    if (picked === "sell") return this.setSelling(!this.selling, true);
    if (picked === "prepare")
      await callAction(HOTDOG_EVENTS.prepare, [], {
        fallback: "HOTDOG_ERR_FAR",
        timeout: 600_000,
      });
  }

  private setSelling(on: boolean, tell = false): void {
    if (on && this.stockLeft() === 0)
      return notify(Locale("HOTDOG_ERR_NO_DOGS"), "error");
    if (this.selling === on) return;
    this.selling = on;
    if (on) this.customers.start();
    else this.customers.stop();
    if (tell)
      notify(Locale(on ? "HOTDOG_SELLING_ON" : "HOTDOG_SELLING_OFF"), "info");
  }

  private async grab(): Promise<void> {
    this.setSelling(false);
    const ok = await callAction(HOTDOG_EVENTS.grab, [], {
      fallback: "HOTDOG_ERR_FAR",
    });
    if (ok) this.pusher.start();
  }
}

export const work = new HotdogWork();
