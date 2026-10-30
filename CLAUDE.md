# ai-jobs

Work routes started at a depot: driving routes (taxi, bus, trucker, garbage, news) with a work vehicle and pay per stop, towing (a broken-down car on the flatbed to the depot), and gathering routes on foot (recycle, vineyard, diving) that give items per stop. One engine, every route and stop set in the panel. Depends on ai-core (jobs, money, prompts, progress); gives work vehicle keys through ai-core's key layer (lib `vehicleKeys`) and uses the active inventory through ai-core's inventory layer (lib `inventory`).

## Decisions

- One combined engine instead of a resource per job: Qbox's job scripts are the same loop (go to a point, do a timed action, get paid). A route's `kind` picks the order: `random` (any other stop next), `ordered` (stops in id order, wraps), `gather` (on foot, items instead of money), `tow` (a locked car spawned at the stop; loading it makes the depot the next stop, paid there).
- The server picks every stop and keeps the shift in memory (`Map<source, Work>`); the client only shows the stop it was sent. Nothing is stored in the DB: a shift ends on leave or resource stop.
- A stop's finish is refused when the player is more than 12 m away, faster than 80% of the stop time, or (driving routes) more than 15 m from the work vehicle.
- Stops are their own panel records naming their route, so each one gets a `point` widget; a route without stops cannot start.
- Pay goes to the bank (`work:<route>` ledger reason).

## Contracts

- Callbacks and the server -> worker `shift` event: `resource/common/routes.ts`.
- Work vehicle: server-created, plate `WORK<source>`, key through ai-vehiclekeys `GiveKeys`, deleted when the shift ends.
- Towing: the server sends `attach` to `NetworkGetEntityOwner` of the towed car (fallback: the worker); the towed car is deleted at the depot or when the shift ends.

## Entry points

- Shift logic `resource/server/index.ts`, panel `resource/server/schema.ts`; depots, stop blip and zone `resource/client/index.ts`.
