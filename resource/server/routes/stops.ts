import type { Stop } from "common/routes";

/** Stops per route in id order, kept per edited stop (one stop edit touches one route's list). */
class RouteStops {
  private readonly byRoute = new Map<string, Map<string, Stop>>();
  private readonly sorted = new Map<string, Stop[]>();

  add(stop: Stop): () => void {
    let map = this.byRoute.get(stop.route);
    if (!map) this.byRoute.set(stop.route, (map = new Map()));
    map.set(stop.id, stop);
    this.sorted.delete(stop.route);
    return () => {
      map.delete(stop.id);
      if (map.size === 0) this.byRoute.delete(stop.route);
      this.sorted.delete(stop.route);
    };
  }

  /** A route's stops in id order (sorted once per change of that route). */
  of(route: string): Stop[] {
    let list = this.sorted.get(route);
    if (!list) {
      list = [...(this.byRoute.get(route)?.values() ?? [])].sort((a, b) =>
        a.id.localeCompare(b.id, "en", { numeric: true }),
      );
      this.sorted.set(route, list);
    }
    return list;
  }
}
export const stops = new RouteStops();
