import {
  Keybind,
  onMembershipChange,
  onServerEvent,
  onStop,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";
import { HOTDOG_EVENTS, toHotdogView, toStandView } from "common/hotdog";
import { world } from "../content";
import { stands } from "./stands";
import { work } from "./work";

onServerEvent(
  HOTDOG_EVENTS.stands,
  {
    args: ([reset, puts, removes]) =>
      [
        reset === true,
        Array.isArray(puts) ? puts.flatMap((v) => toStandView(v) ?? []) : [],
        Array.isArray(removes)
          ? removes.filter((id): id is number => typeof id === "number")
          : [],
      ] as const,
  },
  (reset, puts, removes) => stands.apply(reset, puts, removes),
);
onStop(() => stands.clear());
work.rebuildCounter();
world.onChange("hotdog", () => work.rebuildCounter());
onMembershipChange(() => work.rebuildCounter());
stands.onChange((_view, id) => {
  if (id === work.standId()) work.standChanged();
});
new Keybind({
  name: "jobs_hotdog_release",
  description: Locale("HOTDOG_KEYBIND_RELEASE"),
  defaultKey: "G",
  onPressed: () => void work.release(),
});
onServerEvent(
  HOTDOG_EVENTS.shift,
  { args: ([raw]) => [raw == null ? null : toHotdogView(raw)] as const },
  (shift) => work.setShift(shift),
);
onServerEvent(
  HOTDOG_EVENTS.cooking,
  { args: ([on]) => [on === true] as const },
  (on) => void work.cook.set(on),
);
onStop(() => work.stop());
