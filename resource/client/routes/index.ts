import {
  entityFromNetId,
  onMembershipChange,
  onServerEvent,
} from "@aicore-fivem/lib/client";
import { readId } from "@aicore-fivem/lib/shared";
import { EVENTS, toShift } from "common/routes";
import { work } from "./work";

onMembershipChange(() => work.rebuildLocked());
/** The towed car's owner attaches it to the flatbed (attachments replicate from the owner). */
onServerEvent(
  EVENTS.attach,
  {
    args: ([car, flatbed]): [number, number] | null => {
      const a = readId(car);
      const b = readId(flatbed);
      return a === null || b === null ? null : [a, b];
    },
  },
  (car, flatbed) => {
    const towed = entityFromNetId(car, 2);
    const bed = entityFromNetId(flatbed, 2);
    if (!towed || !bed) return;
    AttachEntityToEntity(
      towed,
      bed,
      GetEntityBoneIndexByName(bed, "bodyshell"),
      0.0,
      -1.6,
      1.0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      20,
      true,
    );
  },
);
onServerEvent(
  EVENTS.shift,
  { args: ([raw]) => [raw == null ? null : toShift(raw)] as const },
  (shift) => work.set(shift),
);
