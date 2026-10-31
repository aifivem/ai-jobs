import {
  onServerEvent,
  onStop,
  playerPed,
  requestModel,
} from "@aicore-fivem/lib/client";
import { HOTDOG_EVENTS, toStandView, type StandView } from "common/hotdog";
import { hotdog } from "./content";

/** Where a pushed stand hangs on the pusher (qb-hotdogjob's offsets on bone 28422). */
const PUSH_BONE = 28422;
const PUSH_OFFSET = [-0.45, -1.2, -0.82, 180, 180, 270] as const;

interface Drawn {
  view: StandView;
  object: number;
}

/**
 * Every stand the server streams around the player, drawn as a local object: standing on the ground, or hanging on
 * its pusher's ped while pushed (each client does the same, so everyone sees it move with the pusher).
 */
class Stands {
  private readonly drawn = new Map<number, Drawn>();
  private changed: (view: StandView | null, id: number) => void = () => {};

  /** Runs after a stand was drawn again or removed (the worker's points follow their own stand). */
  onChange(handler: (view: StandView | null, id: number) => void): void {
    this.changed = handler;
  }

  get(id: number): Drawn | undefined {
    return this.drawn.get(id);
  }

  apply(reset: boolean, puts: StandView[], removes: number[]): void {
    if (reset) for (const id of this.drawn.keys()) this.remove(id);
    for (const id of removes) this.remove(id);
    for (const view of puts) void this.put(view);
  }

  clear(): void {
    for (const id of this.drawn.keys()) this.remove(id);
  }

  private async put(view: StandView): Promise<void> {
    const old = this.drawn.get(view.id);
    if (old) {
      old.view = view;
      this.place(old);
      return this.changed(view, view.id);
    }
    const entry: Drawn = { view, object: 0 };
    this.drawn.set(view.id, entry);
    const model = await requestModel(hotdog.value.model).catch(() => 0);
    // Removed while the model loaded.
    if (!model || this.drawn.get(view.id) !== entry) return;
    entry.object = CreateObject(
      model,
      view.x,
      view.y,
      view.z,
      false,
      false,
      false,
    );
    SetModelAsNoLongerNeeded(model);
    this.place(entry);
    this.changed(entry.view, view.id);
  }

  private remove(id: number): void {
    const entry = this.drawn.get(id);
    if (!entry) return;
    this.drawn.delete(id);
    if (entry.object) DeleteObject(entry.object);
    this.changed(null, id);
  }

  private place({ view, object }: Drawn): void {
    if (!object) return;
    DetachEntity(object, true, false);
    const ped = view.pusher === 0 ? 0 : playerPed(view.pusher);
    if (ped > 0 && DoesEntityExist(ped)) {
      const [x, y, z, rx, ry, rz] = PUSH_OFFSET;
      FreezeEntityPosition(object, false);
      SetEntityCollision(object, false, false);
      AttachEntityToEntity(
        object,
        ped,
        GetPedBoneIndex(ped, PUSH_BONE),
        x,
        y,
        z,
        rx,
        ry,
        rz,
        false,
        false,
        false,
        false,
        1,
        true,
      );
      return;
    }
    SetEntityCoordsNoOffset(
      object,
      view.x,
      view.y,
      view.z,
      false,
      false,
      false,
    );
    SetEntityHeading(object, view.heading);
    PlaceObjectOnGroundProperly(object);
    FreezeEntityPosition(object, true);
    SetEntityCollision(object, true, true);
  }
}

export const stands = new Stands();
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
