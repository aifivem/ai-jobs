import { AreaStream, coordsOf } from "@aicore-fivem/lib/server";
import { distance, type Vec3 } from "@aicore-fivem/lib/shared";
import { HOTDOG_EVENTS, type StandView } from "common/hotdog";

/** How often pushed stands follow their pusher on the server and followers' cells are read. */
export const FOLLOW_MS = 2000;
/** A pushed stand's server position moves once the pusher is this far from it. */
const MOVE_METRES = 8;

/**
 * Every rented stand, streamed to the players around it (lib `AreaStream`, 64 m cells, followers on character load).
 * Clients draw a local stand: no networked object, so no ownership to fight over while one player pushes it. While
 * pushed, each client hangs its copy on the pusher's ped; the server only moves the stand's cell along.
 */
class Stands {
  private nextId = 1;
  private readonly stream = new AreaStream<StandView>({
    event: HOTDOG_EVENTS.stands,
    view: (stand) => stand,
  });

  get(id: number): StandView | undefined {
    return this.stream.get(id);
  }

  add(owner: number, at: Vec3, heading: number): StandView {
    const stand: StandView = {
      id: this.nextId++,
      x: at.x,
      y: at.y,
      z: at.z,
      heading,
      owner,
      pusher: 0,
    };
    this.stream.set(stand);
    return stand;
  }

  /** The stand with new fields; every client around gets it. */
  update(id: number, change: Partial<Omit<StandView, "id" | "owner">>): void {
    const stand = this.stream.get(id);
    if (stand) this.stream.set({ ...stand, ...change });
  }

  remove(id: number): void {
    this.stream.delete(id);
  }

  start(source: number): void {
    this.stream.start(source);
  }

  stop(source: number): void {
    this.stream.stop(source);
  }

  /** Followers' cells, and pushed stands' cells along with their pushers (their clients draw them on the ped). */
  follow(): void {
    if (this.stream.size === 0) return;
    this.stream.followAll();
    for (const stand of this.stream.values()) {
      if (!stand.pusher) continue;
      const p = coordsOf(stand.pusher);
      if (distance(p, stand) > MOVE_METRES)
        this.stream.set({ ...stand, x: p.x, y: p.y, z: p.z }, false);
    }
  }
}

export const stands = new Stands();
