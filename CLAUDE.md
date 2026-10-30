# ai-jobs

Work routes started at a depot: driving routes (taxi, bus, trucker, garbage, news) with a work vehicle and pay per stop, towing (a broken-down car on the flatbed to the depot), and gathering routes on foot (recycle, vineyard, diving) that give items per stop. One engine, every route and stop set in the panel. Depends on ai-core (jobs, money, prompts, progress); gives work vehicle keys through ai-core's key layer (lib `vehicleKeys`) and uses the active inventory through ai-core's inventory layer (lib `inventory`).

## Decisions

- One combined engine instead of a resource per job: Qbox's job scripts are the same loop (go to a point, do a timed action, get paid). A route's `kind` picks the order: `random` (any other stop next), `ordered` (stops in id order, wraps), `gather` (on foot, items instead of money), `tow` (a locked car spawned at the stop; loading it makes the depot the next stop, paid there).
- The server picks every stop and keeps the shift in memory (lib `PlayerMap`, vehicles deleted on drop); the client only shows the stop it was sent. Nothing is stored in the DB: a shift ends on leave or resource stop. A player who drops while the work vehicle or the towed car spawns gets nothing stored and the vehicles are deleted (`isOnline` after every await).
- A stop's finish is refused when the player is more than 12 m away, sooner than the way from the last stop (or the depot) at 60 m/s plus 80% of the stop time (teleports), or (driving routes) more than 15 m from the work vehicle. A tow is paid only when the towed car is within 15 m of the flatbed at the depot (`JOBS_ERR_TOW_LOST`).
- Per route in the panel: gather item count range (`gatherMin` / `gatherMax`), the tow route's car models (`towModels`), the depot blip (`blip`, default sprite by kind). Towed cars spawn locked through `spawnVehicle({ locked: true })`.
- Stops are their own panel records naming their route, so each one gets a `point` widget; a route without stops cannot start.
- Pay goes to the bank (`work:<route>` ledger reason).

## Contracts

- Callbacks and the server -> worker `shift` event: `resource/common/routes.ts`.
- Work vehicle: lib `spawnVehicle` (spawn type from the worker's client), plate `WORK<source>`, keys through lib `vehicleKeys` with purpose `job`, deleted when the shift ends.
- Towing: the server sends `attach` to `NetworkGetEntityOwner` of the towed car (fallback: the worker); the towed car is deleted at the depot or when the shift ends.

## Entry points

- Shift logic `resource/server/index.ts`, panel `resource/server/schema.ts`; depot and stop points (lib `Points`), stop route blip `resource/client/index.ts`.
