exports = globalThis.exports;
let node_fs_promises = require("node:fs/promises");
// ../../../packages/lib/src/server/rateLimit.ts
var SourceLock = class {
	active = new Set();
	async run(source, busy, task) {
		if (this.active.has(source)) return busy;
		this.active.add(source);
		try {
			return await task();
		} finally {
			this.active.delete(source);
		}
	}
	release(source) {
		this.active.delete(source);
	}
}, RateLimit = class {
	count;
	windowMs;
	hits = new Map();
	constructor(count, windowMs) {
		this.count = count, this.windowMs = windowMs;
	}
	take(source) {
		let now = GetGameTimer(), recent = (this.hits.get(source) ?? []).filter((at) => now - at < this.windowMs);
		return recent.length >= this.count ? (this.hits.set(source, recent), !1) : (recent.push(now), this.hits.set(source, recent), !0);
	}
	release(source) {
		this.hits.delete(source);
	}
};
// ../../../packages/lib/src/shared/wait.ts
function waitFor(check, timeoutMs = 1e4, intervalMs = 0) {
	return new Promise((resolve, reject) => {
		let started = Date.now(), poll = () => {
			let value = check();
			if (value !== void 0) return resolve(value);
			if (timeoutMs !== !1 && Date.now() - started > timeoutMs) return reject(Error(`waitFor timed out after ${timeoutMs} ms`));
			setTimeout(poll, intervalMs);
		};
		poll();
	});
}
// ../../../packages/lib/src/shared/read.ts
function num$1(value, fallback, min = -Infinity, max = Infinity) {
	return typeof value == "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function int(value, fallback, min = -Infinity, max = Infinity) {
	return Math.round(num$1(value, fallback, min, max));
}
function bool(value, fallback) {
	return typeof value == "boolean" ? value : fallback;
}
function str(value, fallback, max = 64) {
	return typeof value == "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
function record(value) {
	return typeof value == "object" && value && !Array.isArray(value) ? value : {};
}
function vec4(value, fallback) {
	let v = record(value);
	return {
		x: num$1(v.x, fallback.x),
		y: num$1(v.y, fallback.y),
		z: num$1(v.z, fallback.z),
		heading: num$1(v.heading, fallback.heading)
	};
}
// ../../../packages/lib/src/shared/strict.ts
function readFinite(value) {
	return typeof value == "number" && Number.isFinite(value) ? value : null;
}
function readText(value, max) {
	if (typeof value != "string") return null;
	let text = value.trim();
	return text ? text.slice(0, max) : null;
}
const oneArg = (read) => ([value]) => {
	let parsed = read(value);
	return parsed === null ? null : [parsed];
}, fail = (error) => ({
	ok: !1,
	error
}), distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1)), pickRandom = (list) => list[Math.floor(Math.random() * list.length)], rollChance = (percent) => Math.random() * 100 < percent, names = (v) => Array.isArray(v) ? v.filter((x) => typeof x == "string") : [];
function readAccess(value) {
	let v = record(value), grades = {};
	for (let [name, grade] of Object.entries(record(v.grades))) typeof grade == "number" && Number.isInteger(grade) && grade >= 0 && (grades[name] = grade);
	return {
		jobs: names(v.jobs),
		gangs: names(v.gangs),
		grades,
		onDuty: bool(v.onDuty, !1)
	};
}
const isPublic = (rule) => rule.jobs.length === 0 && rule.gangs.length === 0, ACCESS_FIELDS = {
	jobs: {
		type: "names",
		lookup: "job",
		optional: !0
	},
	gangs: {
		type: "names",
		lookup: "gang",
		optional: !0
	},
	onDuty: {
		type: "bool",
		optional: !0
	}
};
function accessFields() {
	return [
		{
			widget: "tags",
			lookup: "job",
			path: "jobs",
			label: "ADMIN_F_ACCESS_JOBS",
			hint: "ADMIN_H_ACCESS_JOBS",
			placeholder: "ADMIN_P_ACCESS_JOBS"
		},
		{
			widget: "tags",
			lookup: "gang",
			path: "gangs",
			label: "ADMIN_F_ACCESS_GANGS",
			hint: "ADMIN_H_ACCESS_GANGS",
			placeholder: "ADMIN_P_ACCESS_GANGS"
		},
		{
			widget: "switch",
			path: "onDuty",
			label: "ADMIN_F_ACCESS_ON_DUTY",
			hint: "ADMIN_H_ACCESS_ON_DUTY"
		}
	];
}
// ../../../packages/lib/src/shared/blipStyle.ts
const BLIP_STYLE_FIELDS = {
	sprite: {
		type: "number",
		min: 0,
		max: 1e3,
		integer: !0
	},
	color: {
		type: "number",
		min: 0,
		max: 100,
		integer: !0
	},
	scale: {
		type: "number",
		min: .3,
		max: 2
	}
};
function readBlipStyle(value, fallback) {
	let v = record(value);
	return {
		sprite: int(v.sprite, fallback.sprite, 0, 1e3),
		color: int(v.color, fallback.color, 0, 100),
		scale: num$1(v.scale, fallback.scale, .3, 2)
	};
}
// ../../../packages/lib/src/shared/records.ts
const isObject = (value) => typeof value == "object" && !!value && !Array.isArray(value);
function readRecords(raw, readOne) {
	let out = new Map();
	if (!isObject(raw)) return out;
	for (let key in raw) {
		let value = raw[key];
		if (!isObject(value)) continue;
		let parsed = readOne(key, value);
		parsed !== null && out.set(key, parsed);
	}
	return out;
}
var FileViews = class {
	read;
	updaters = new Map();
	constructor(read) {
		this.read = read;
	}
	view(file, parse) {
		let box = { value: parse(this.read(file)) };
		return this.on(file, () => box.value = parse(this.read(file))), box;
	}
	records(file, readOne) {
		let live = new LiveRecords(readOne);
		return live.reset(this.read(file)), this.on(file, (key, value) => live.update(key, value, this.read(file))), live.map;
	}
	changed(file, key, value) {
		for (let update of this.updaters.get(file) ?? []) update(key, value);
	}
	on(file, update) {
		let list = this.updaters.get(file);
		list ? list.push(update) : this.updaters.set(file, [update]);
	}
}, LiveRecords = class {
	readOne;
	map = new Map();
	constructor(readOne) {
		this.readOne = readOne;
	}
	reset(raw) {
		this.map.clear();
		for (let [key, value] of readRecords(raw, this.readOne)) this.map.set(key, value);
	}
	update(key, value, whole) {
		if (key === void 0) return this.reset(whole);
		let parsed = isObject(value) ? this.readOne(key, value) : null;
		parsed === null ? this.map.delete(key) : this.map.set(key, parsed);
	}
}, RecordObjects = class {
	build;
	records;
	built = new Map();
	constructor(source, file, records, build) {
		this.build = build, this.records = typeof records == "function" ? source.records(file, records) : records, source.onChange(file, (key) => key === void 0 ? this.rebuildAll() : this.rebuild(key)), this.rebuildAll();
	}
	rebuild(key) {
		this.built.get(key)?.(), this.built.delete(key);
		let record = this.records.get(key);
		if (record === void 0) return;
		let remove = this.build(key, record);
		remove && this.built.set(key, remove);
	}
	rebuildAll() {
		for (let remove of this.built.values()) remove();
		this.built.clear();
		for (let [key, record] of this.records) {
			let remove = this.build(key, record);
			remove && this.built.set(key, remove);
		}
	}
};
// ../../../packages/lib/src/shared/lang.ts
function formatText(template, args) {
	return template.replace(/\{(\d+)\}/g, (match, index) => {
		let value = args[Number(index)];
		return value === void 0 ? match : String(value);
	});
}
// ../../../packages/lib/src/shared/placePed.ts
const isRecord$1 = (v) => typeof v == "object" && !!v && !Array.isArray(v), SCENARIOS = [
	"",
	"WORLD_HUMAN_STAND_IMPATIENT",
	"WORLD_HUMAN_CLIPBOARD",
	"WORLD_HUMAN_STAND_MOBILE",
	"WORLD_HUMAN_AA_COFFEE",
	"WORLD_HUMAN_SMOKING",
	"WORLD_HUMAN_GUARD_STAND",
	"WORLD_HUMAN_COP_IDLES",
	"WORLD_HUMAN_HANG_OUT_STREET"
], PLACE_PED_SPEC = {
	type: "object",
	optional: !0,
	fields: {
		model: {
			type: "text",
			max: 64,
			optional: !0
		},
		scenario: {
			type: "enum",
			values: [...SCENARIOS],
			optional: !0
		},
		coords: {
			type: "vec4",
			optional: !0
		}
	}
};
function placePedFields(path = "ped") {
	return [
		{
			widget: "model",
			kind: "ped",
			path: `${path}.model`,
			label: "ADMIN_F_PED_MODEL",
			hint: "ADMIN_H_PED_MODEL",
			placeholder: "ADMIN_PH_PED_MODEL"
		},
		{
			widget: "select",
			path: `${path}.scenario`,
			label: "ADMIN_F_PED_SCENARIO",
			hint: "ADMIN_H_PED_SCENARIO",
			options: SCENARIOS.map((value) => ({
				value,
				label: value ? `ADMIN_O_SCENARIO_${value}` : "ADMIN_O_SCENARIO_NONE"
			}))
		},
		{
			widget: "point",
			path: `${path}.coords`,
			heading: !0,
			ground: !0,
			label: "ADMIN_F_PED_POSITION",
			hint: "ADMIN_H_PED_POSITION"
		}
	];
}
function readPlacePed(value) {
	if (!isRecord$1(value) || typeof value.model != "string" || !value.model.trim()) return null;
	let c = value.coords, coords = isRecord$1(c) && [
		c.x,
		c.y,
		c.z,
		c.heading
	].every((n) => typeof n == "number") ? {
		x: Number(c.x),
		y: Number(c.y),
		z: Number(c.z),
		heading: Number(c.heading)
	} : void 0;
	return {
		model: value.model.trim(),
		scenario: typeof value.scenario == "string" && value.scenario ? value.scenario : void 0,
		coords
	};
}
// ../../../packages/lib/src/shared/grid.ts
const OFFSET = 16384, clampCell = (v) => Math.max(-16e3, Math.min(16e3, v)), gridCell = (x, y, size) => ({
	cx: clampCell(Math.floor(x / size)),
	cy: clampCell(Math.floor(y / size))
}), cellKey = (cx, cy) => (clampCell(cx) + OFFSET) * 32768 + (clampCell(cy) + OFFSET);
// ../../../packages/lib/src/shared/index.ts
function isRecord(value) {
	return typeof value == "object" && !!value && !Array.isArray(value);
}
function logSafe(text, max) {
	return text.replace(/\r?\n/g, " | ").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\^\d/g, "").slice(0, max);
}
function previewJson(value, max) {
	let out = "", walk = (v, depth) => {
		if (out.length >= max) return;
		if (typeof v == "string") {
			out += JSON.stringify(v.length > max ? v.slice(0, max) : v);
			return;
		}
		if (typeof v != "object" || !v) {
			out += String(v);
			return;
		}
		if (depth > 4) {
			out += Array.isArray(v) ? "[...]" : "{...}";
			return;
		}
		if (Array.isArray(v)) {
			out += "[";
			for (let i = 0; i < v.length && out.length < max; i++) i > 0 && (out += ","), walk(v[i], depth + 1);
			out += "]";
			return;
		}
		out += "{";
		let first = !0;
		for (let key in v) {
			if (out.length >= max) break;
			first || (out += ","), first = !1, out += `${JSON.stringify(key.slice(0, 50))}:`, walk(v[key], depth + 1);
		}
		out += "}";
	};
	return walk(value, 0), out.slice(0, max);
}
function createLogger(resource) {
	let prefix = `[${resource}]`;
	return {
		info: (message, ...details) => console.log(`${prefix} ${message}`, ...details),
		warn: (message, ...details) => console.warn(`${prefix} ^3${message}^7`, ...details),
		error: (message, ...details) => console.error(`${prefix} ^1${message}^7`, ...details)
	};
}
function withoutSchemaKey(value) {
	if (!isRecord(value) || !("$schema" in value)) return value;
	let { $schema: _schema, ...rest } = value;
	return rest;
}
var DataFile = class {
	resource;
	name;
	log;
	writes = Promise.resolve();
	pending = void 0;
	timer = null;
	schemaRef = null;
	constructor(resource, name, log) {
		this.resource = resource, this.name = name, this.log = log;
	}
	hasSchemaRef() {
		return (LoadResourceFile(this.resource, this.path) ?? "").includes("\"$schema\"");
	}
	read() {
		for (let path of [this.path, `${this.path}.bak`]) {
			let raw = LoadResourceFile(this.resource, path);
			if (raw) try {
				return withoutSchemaKey(JSON.parse(raw));
			} catch (error) {
				this.log.error(`${this.resource}/${path} is not valid JSON${path === this.path ? ", trying the backup" : ""}`, error);
			}
		}
		return null;
	}
	write(value) {
		this.pending = value, this.timer ||= setTimeout(() => {
			this.timer = null;
			let data = this.schemaRef && isRecord(this.pending) ? {
				$schema: this.schemaRef,
				...this.pending
			} : this.pending, text = `${JSON.stringify(data, null, 2)}\n`;
			this.writes = this.writes.then(() => this.flush(text)).catch((error) => this.log.error(`saving ${this.resource}/${this.path} failed`, error));
		}, 250);
	}
	get path() {
		return `data/${this.name}.json`;
	}
	async flush(text) {
		let file = `${GetResourcePath(this.resource)}/${this.path}`;
		await (0, node_fs_promises.mkdir)(file.slice(0, file.lastIndexOf("/")), { recursive: !0 }), await (0, node_fs_promises.writeFile)(`${file}.tmp`, text, "utf8"), await (0, node_fs_promises.copyFile)(file, `${file}.bak`).catch(() => void 0), await (0, node_fs_promises.rename)(`${file}.tmp`, file);
	}
};
// ../../../packages/shared/src/core.ts
const CORE = {
	resource: "ai-core",
	clientErrorEvent: "ai-core:clientError",
	playerLoadedEvent: "ai-core:playerLoaded",
	playerSpawnedEvent: "ai-core:playerSpawned",
	playerUnloadedEvent: "ai-core:playerUnloaded",
	moneyChangedEvent: "ai-core:moneyChanged",
	jobsChangedEvent: "ai-core:jobsChanged",
	dutyChangedEvent: "ai-core:dutyChanged",
	gangsChangedEvent: "ai-core:gangsChanged",
	activeGangChangedEvent: "ai-core:activeGangChanged",
	metaChangedEvent: "ai-core:metaChanged",
	definitionsChangedEvent: "ai-core:definitionsChanged",
	characterDeletedEvent: "ai-core:characterDeleted",
	runtimeJobPrefix: "ai:jobdef:",
	runtimeGangPrefix: "ai:gangdef:",
	characterScreenEvent: "ai-core:characterScreen",
	inventoryChangedEvent: "ai-core:inventoryChanged",
	itemUsedEvent: "ai-core:itemUsed",
	playerDiedEvent: "ai-core:playerDied",
	clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
	clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
	clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
	characterLooksEvent: "ai-core:client:characterLooks",
	clientCacheEvent: "ai-core:client:cache",
	clientHudVisibleEvent: "ai-core:client:hudVisible",
	clientWorldSyncEvent: "ai-core:client:worldSync",
	clientDefinitionsEvent: "ai-core:client:definitions",
	vehicleTypeCallback: "ai-core:vehicleType",
	interactionStateKey: "ai:interaction",
	pvpStateKey: "ai:pvp",
	medicalStateKey: "ai:medical",
	clientDeadEvent: "ai-core:client:dead",
	mdtStateKey: "ai:mdt",
	billsEvent: "ai-core:client:bills",
	payBillCallback: "ai-core:payBill",
	clientSeatbeltEvent: "ai-core:client:seatbelt",
	stressRelayEvent: "ai-core:client:stress",
	notifyStateKey: "ai:notify",
	charactersCallback: "ai-core:characters",
	createCharacterCallback: "ai-core:createCharacter",
	deleteCharacterCallback: "ai-core:deleteCharacter",
	selectCharacterCallback: "ai-core:selectCharacter",
	spawnEvent: "ai-core:client:spawn",
	chooseSpawnEvent: "ai-core:client:chooseSpawn",
	spawnChoiceCallback: "ai-core:spawnChoice",
	openCharactersEvent: "ai-core:client:openCharacters",
	characterScreenKey: "ai:characterScreen",
	externalLoadedEvent: "ai-core:client:externalLoaded",
	externalSpawnedEvent: "ai-core:externalSpawned",
	externalLogoutEvent: "ai-core:client:externalLogout"
}, ADMIN = {
	ace: "ai.admin",
	openCallback: "ai-core:admin:open",
	panelDataCallback: "ai-core:admin:panelData",
	applyCallback: "ai-core:admin:apply",
	closeEvent: "ai-core:admin:close",
	showEvent: "ai-core:admin:show",
	deltaEvent: "ai-core:admin:delta",
	recommendationEvent: "ai-core:admin:recommendation",
	worldEvent: (resource) => `${resource}:admin:world`,
	worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
}, VEHICLE_BAGS = {
	owned: "ai:owned",
	id: "ai:vid",
	props: "ai:props",
	setup: "ai:setup",
	fuel: "fuel"
}, SKILL_STAGES = {
	easy: {
		area: 50,
		speed: .6
	},
	medium: {
		area: 40,
		speed: .85
	},
	hard: {
		area: 25,
		speed: 1
	}
}, LOCKPICK_AREAS = {
	easy: 18,
	medium: 11,
	hard: 6
}, LIB_UI = {
	resource: "ai-lib",
	notifyEvent: "ai-lib:client:notify",
	promptPressedEvent: "ai-lib:client:promptPressed",
	cancelProgressEvent: "ai-lib:client:cancelProgress",
	progressForCallback: "ai-lib:progressFor",
	progressForCancelEvent: "ai-lib:client:progressForCancel",
	minigameForCallback: "ai-lib:minigameFor",
	zoneEvent: "ai-lib:client:zone",
	modelPointEvent: "ai-lib:client:modelPoint"
}, named = new Set();
function registerExport(name, handler) {
	named.add(name), globalThis.exports(name, handler);
	let first = name.charAt(0), twin = (first === first.toUpperCase() ? first.toLowerCase() : first.toUpperCase()) + name.slice(1);
	twin !== name && !named.has(twin) && globalThis.exports(twin, handler);
}
function resourceExport(resource) {
	return globalThis.exports[resource];
}
function isResourceStarted(resource) {
	return GetResourceState(resource) === "started";
}
function optionalExport(resource) {
	return isResourceStarted(resource) ? globalThis.exports[resource] : null;
}
function readLocaleFile(resource, lang) {
	let raw = LoadResourceFile(resource, `locales/${lang}.json`);
	if (!raw) return {};
	let parsed = JSON.parse(raw);
	if (!isRecord(parsed)) return {};
	let texts = {};
	for (let [key, value] of Object.entries(parsed)) typeof value == "string" && (texts[key] = value);
	return texts;
}
function createLocale() {
	let texts = loadLocaleTexts();
	return (key, ...args) => formatText(texts[key] ?? key, args);
}
function loadLocaleTexts(resource = GetCurrentResourceName()) {
	let lang = GetConvar("ai:locale", "en"), texts = {
		...readLocaleFile(resource, "en"),
		...lang === "en" ? {} : readLocaleFile(resource, lang)
	};
	for (let key of Object.keys(texts)) texts[key] = (texts[key] ?? "").replace(/\$\{([A-Z0-9_]+)\}/g, (match, ref) => texts[ref] ?? match);
	return texts;
}
// ../../../packages/lib/src/fivem/callbackNames.ts
const requestEvent = (name) => `aicore:cb:${name}`, responseEvent = (resource) => `aicore:cbr:${resource}`;
// ../../../packages/lib/src/server/position.ts
function entityCoords(entity) {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(entity);
	return {
		x,
		y,
		z
	};
}
const coordsOf = (source) => entityCoords(GetPlayerPed(String(source)));
function isNear(source, point, metres) {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source))), dx = x - point.x, dy = y - point.y, dz = z - point.z;
	return dx * dx + dy * dy + dz * dz <= metres * metres;
}
resourceExport(CORE.resource);
const log$6 = createLogger(GetCurrentResourceName()), gates = new Set();
on("playerDropped", () => {
	let source = Number(globalThis.source);
	for (let gate of gates) gate.release(source);
});
var ClientGate = class {
	name;
	options;
	limit;
	lock;
	refusals = new Map();
	constructor(name, options, defaultRate) {
		this.name = name, this.options = options, this.limit = new RateLimit(options.rate?.count ?? defaultRate, options.rate?.windowMs ?? 1e3), this.lock = options.lock ? new SourceLock() : null, gates.add(this);
	}
	check(source, raw) {
		if (!(source > 0) || !GetPlayerName(String(source))) return null;
		if (!this.limit.take(source)) return this.refuse(source, "rate limit"), null;
		for (let guard of this.options.guards ?? []) {
			let verdict = guard(source);
			if (verdict !== !0) return typeof verdict == "string" && this.refuse(source, verdict), null;
		}
		if (!this.options.args) return [];
		let args = this.options.args(raw);
		return args === null && this.refuse(source, () => `invalid arguments ${logSafe(previewJson(raw, 200), 200)}`), args;
	}
	run(source, busy, task) {
		return this.lock ? this.lock.run(source, busy, async () => task()) : Promise.resolve(task());
	}
	release(source) {
		this.limit.release(source), this.lock?.release(source), this.refusals.delete(source);
	}
	refuse(source, reason) {
		let now = GetGameTimer(), last = this.refusals.get(source);
		if (last && now - last.at < 1e4) {
			last.skipped++;
			return;
		}
		let more = last?.skipped ? ` (+${last.skipped} more refused)` : "";
		this.refusals.set(source, {
			at: now,
			skipped: 0
		}), log$6.warn(`${this.name} refused for ${GetPlayerName(String(source))} (${source}): ${typeof reason == "string" ? reason : reason()}${more}`);
	}
};
// ../../../packages/lib/src/server/callback.ts
const log$5 = createLogger(GetCurrentResourceName()), resource$1 = GetCurrentResourceName(), REFUSED = Symbol("refused");
function onClientCallback(name, first, second) {
	let [handler, options] = typeof first == "function" ? [first, second ?? {}] : [second, first], gate = new ClientGate(name, options, 20);
	onNet(requestEvent(name), async (caller, id, ...raw) => {
		let source = Number(globalThis.source);
		if (typeof caller != "string" || caller.length > 64 || typeof id != "number") return;
		let args = gate.check(source, raw);
		if (!args) return emitNet(responseEvent(caller), source, id, !1, null);
		try {
			let result = await gate.run(source, REFUSED, () => handler(source, ...args));
			result === REFUSED ? emitNet(responseEvent(caller), source, id, !1, null) : emitNet(responseEvent(caller), source, id, !0, result ?? null);
		} catch (error) {
			log$5.error(`callback ${name} failed for ${source}`, error), emitNet(responseEvent(caller), source, id, !1, null);
		}
	});
}
const pending = new Map();
let nextId = 0;
onNet(responseEvent(resource$1), (id, ok, result) => {
	let entry = typeof id == "number" ? pending.get(id) : void 0;
	entry && entry.source === Number(globalThis.source) && (pending.delete(id), clearTimeout(entry.timer), ok === !0 ? entry.resolve(result) : entry.reject(Error("client callback failed")));
});
function triggerClientCallback(name, source, args = [], timeoutMs = 3e4) {
	let id = ++nextId;
	return new Promise((resolve, reject) => {
		let timer = setTimeout(() => {
			pending.delete(id), reject(Error(`client callback ${name} timed out for ${source}`));
		}, timeoutMs);
		pending.set(id, {
			source,
			resolve,
			reject,
			timer
		}), emitNet(requestEvent(name), source, resource$1, id, ...args);
	});
}
// ../../../packages/lib/src/server/admin/patch.ts
function toPatch(value) {
	if (!isRecord(value) || typeof value.file != "string") return null;
	let key = typeof value.key == "string" ? value.key : void 0;
	switch (value.action) {
		case "set": return typeof value.section == "string" ? {
			file: value.file,
			action: "set",
			key,
			section: value.section,
			value: value.value
		} : null;
		case "create": return key && typeof value.label == "string" ? {
			file: value.file,
			action: "create",
			key,
			label: value.label
		} : null;
		case "delete": return key ? {
			file: value.file,
			action: "delete",
			key
		} : null;
		case "run": return typeof value.id == "string" && value.id.length <= 64 ? {
			file: value.file,
			action: "run",
			key,
			id: value.id
		} : null;
		case "import": {
			if (!isRecord(value.records)) return null;
			let records = {};
			for (let [k, v] of Object.entries(value.records)) isRecord(v) && (records[k] = v);
			return Object.keys(records).length > 0 && Object.keys(records).length <= 500 ? {
				file: value.file,
				action: "import",
				records
			} : null;
		}
		default: return null;
	}
}
const clone = (value) => value === void 0 ? value : JSON.parse(JSON.stringify(value)), core$28 = resourceExport(CORE.resource), ERR = {
	type: "ADMIN_ERR_TYPE",
	range: "ADMIN_ERR_RANGE",
	length: "ADMIN_ERR_LENGTH",
	pattern: "ADMIN_ERR_PATTERN",
	required: "ADMIN_ERR_REQUIRED",
	lookup: "ADMIN_ERR_LOOKUP"
}, lookups = new class {
	lists = new Map();
	values(source) {
		let cached = this.lists.get(source);
		if (cached && Date.now() - cached.at < 2e3) return cached.values.size > 0 ? cached.values : null;
		let list = [];
		try {
			list = core$28.GetLookupValues(source);
		} catch {}
		let values = new Set(Array.isArray(list) ? list.filter((v) => typeof v == "string") : []);
		return this.lists.set(source, {
			at: Date.now(),
			values
		}), values.size > 0 ? values : null;
	}
}(), isVec = (value, keys) => isRecord(value) && keys.every((k) => typeof value[k] == "number" && Number.isFinite(value[k]));
function validate(spec, value, path) {
	if (value == null) return spec.optional ? null : {
		error: ERR.required,
		path
	};
	let fail = (error) => ({
		error,
		path
	});
	switch (spec.type) {
		case "text": return typeof value == "string" ? value.length < (spec.min ?? 1) || value.length > (spec.max ?? 120) ? fail(ERR.length) : spec.pattern && !new RegExp(spec.pattern).test(value) ? fail(ERR.pattern) : spec.lookup && value !== "" && lookups.values(spec.lookup)?.has(value) === !1 ? fail(ERR.lookup) : null : fail(ERR.type);
		case "number": return typeof value != "number" || !Number.isFinite(value) || spec.integer && !Number.isInteger(value) ? fail(ERR.type) : spec.min !== void 0 && value < spec.min || spec.max !== void 0 && value > spec.max ? fail(ERR.range) : null;
		case "bool": return typeof value == "boolean" ? null : fail(ERR.type);
		case "enum": return spec.values.includes(value) ? null : fail(ERR.type);
		case "names": {
			if (!Array.isArray(value) || value.length > (spec.max ?? 50)) return fail(ERR.length);
			let pattern = new RegExp(spec.pattern ?? "^[\\w.:-]+$"), seen = new Set();
			for (let name of value) {
				if (typeof name != "string" || name.length > (spec.itemMax ?? 64) || seen.has(name)) return fail(ERR.type);
				if (!pattern.test(name)) return fail(ERR.pattern);
				if (spec.lookup && lookups.values(spec.lookup)?.has(name) === !1) return fail(ERR.lookup);
				seen.add(name);
			}
			return null;
		}
		case "vec3": return isVec(value, [
			"x",
			"y",
			"z"
		]) ? null : fail(ERR.type);
		case "vec4": return isVec(value, [
			"x",
			"y",
			"z",
			"heading"
		]) ? null : fail(ERR.type);
		case "object":
			if (!isRecord(value)) return fail(ERR.type);
			for (let key of Object.keys(value)) if (!(key in spec.fields)) return {
				error: ERR.type,
				path: `${path}.${key}`
			};
			for (let [key, field] of Object.entries(spec.fields)) {
				let refusal = validate(field, value[key], `${path}.${key}`);
				if (refusal) return refusal;
			}
			return null;
		case "list":
			if (!Array.isArray(value)) return fail(ERR.type);
			if (value.length < (spec.min ?? 0) || value.length > (spec.max ?? 100)) return fail(ERR.length);
			for (let i = 0; i < value.length; i++) {
				let refusal = validate(spec.of, value[i], `${path}.${i + 1}`);
				if (refusal) return refusal;
			}
			return null;
		default: return spec;
	}
}
// ../../../packages/lib/src/server/admin/edit.ts
const DEFAULT_KEY = "^[a-z0-9_]{2,32}$";
function imported(spec, value) {
	let base = clone(spec.newRecord ?? {}), out = {};
	for (let name of Object.keys(spec.sections)) {
		let v = name in value ? value[name] : base[name];
		v !== void 0 && (out[name] = clone(v));
	}
	return out;
}
function linked(spec, value, ctx) {
	return spec.type === "text" && spec.records && typeof value == "string" && value !== "" && !(value in ctx.get(spec.records)) ? "ADMIN_ERR_LOOKUP" : null;
}
function checkEdit(patch, spec, ctx) {
	let data = ctx.get(patch.file);
	if (patch.action === "create") return spec.kind !== "records" || !new RegExp(spec.keyPattern ?? DEFAULT_KEY).test(patch.key) ? ERR.pattern : patch.key in data ? "ADMIN_ERR_EXISTS" : null;
	if (patch.action === "delete") return spec.kind !== "records" || !(patch.key in data) ? ERR.type : spec.locked?.includes(patch.key) ? "ADMIN_ERR_LOCKED" : null;
	if (patch.action === "import") {
		if (spec.kind !== "records") return ERR.type;
		let pattern = new RegExp(spec.keyPattern ?? DEFAULT_KEY);
		for (let [key, value] of Object.entries(patch.records)) {
			if (!pattern.test(key)) return ERR.pattern;
			let record = imported(spec, value);
			for (let [name, section] of Object.entries(spec.sections)) {
				let refusal = validate(section, record[name], name);
				if (refusal) return refusal.error;
				let link = linked(section, record[name], ctx);
				if (link) return link;
			}
			let ruled = ctx.rule(patch.file)?.(key, record);
			if (ruled) return ruled;
		}
		return null;
	}
	let section = spec.sections[patch.section];
	if (!section || spec.kind === "records" && (!patch.key || !(patch.key in data))) return ERR.type;
	let refusal = validate(section, patch.value, patch.section);
	if (refusal) return refusal.error;
	let link = linked(section, patch.value, ctx);
	if (link) return link;
	let current = spec.kind === "records" ? data[patch.key ?? ""] : data, next = {
		...isRecord(current) ? current : {},
		[patch.section]: patch.value
	};
	return ctx.rule(patch.file)?.(patch.key, next) ?? null;
}
function applyEdit(data, patch, spec) {
	if (patch.action === "import") {
		for (let [key, value] of Object.entries(patch.records)) data[key] = imported(spec, value);
		return Object.keys(patch.records);
	}
	if (patch.action === "create") {
		let record = clone(spec.newRecord ?? {});
		spec.labelPath && (record[spec.labelPath] = patch.label), data[patch.key] = record;
	} else if (patch.action === "delete") delete data[patch.key];
	else {
		let target = spec.kind === "records" ? data[patch.key ?? ""] : data;
		if (!isRecord(target)) return [];
		patch.value === void 0 || patch.value === null ? delete target[patch.section] : target[patch.section] = clone(patch.value);
	}
	return [spec.kind === "records" ? patch.key : void 0];
}
// ../../../packages/lib/src/server/admin/jsonSchema.ts
const SCHEMA_KEY = {
	type: "string",
	description: "This file's JSON Schema (for editors)."
};
function langFile(resource) {
	try {
		let raw = JSON.parse(LoadResourceFile(resource, "locales/en.json") ?? "{}");
		return isRecord(raw) ? Object.fromEntries(Object.entries(raw).filter((e) => typeof e[1] == "string")) : {};
	} catch {
		return {};
	}
}
function texts(resource) {
	return {
		...langFile("ai-core"),
		...langFile(resource)
	};
}
function collect(fields, prefix, lang, out) {
	for (let field of fields) {
		if (field.widget === "action") continue;
		let path = prefix + field.path, label = lang[field.label] ?? field.label, hint = field.hint ? lang[field.hint] ?? field.hint : "";
		out.has(path) || out.set(path, hint ? `${label}: ${hint}` : label), field.widget === "list" && collect(field.rows, `${path}[].`, lang, out);
	}
}
function describe(schema, file, lang) {
	let out = new Map();
	for (let tab of schema.tabs) if (tab.file === file) for (let card of tab.cards) collect(card.fields, "", lang, out);
	return out;
}
function toJson(spec, path, desc) {
	let description = desc.get(path), base = description ? { description } : {};
	switch (spec.type) {
		case "text": return {
			...base,
			type: "string",
			minLength: spec.min,
			maxLength: spec.max,
			pattern: spec.pattern
		};
		case "number": return {
			...base,
			type: spec.integer ? "integer" : "number",
			minimum: spec.min,
			maximum: spec.max
		};
		case "bool": return {
			...base,
			type: "boolean"
		};
		case "enum": return {
			...base,
			enum: spec.values
		};
		case "names": return {
			...base,
			type: "array",
			maxItems: spec.max,
			uniqueItems: !0,
			items: {
				type: "string",
				maxLength: spec.itemMax,
				pattern: spec.pattern
			}
		};
		case "vec3":
		case "vec4": {
			let keys = spec.type === "vec3" ? [
				"x",
				"y",
				"z"
			] : [
				"x",
				"y",
				"z",
				"heading"
			];
			return {
				...base,
				type: "object",
				required: keys,
				properties: Object.fromEntries(keys.map((k) => [k, { type: "number" }]))
			};
		}
		case "object": return {
			...base,
			...objectOf(spec.fields, path ? `${path}.` : "", desc)
		};
		case "list": return {
			...base,
			type: "array",
			minItems: spec.min,
			maxItems: spec.max,
			items: toJson(spec.of, `${path}[]`, desc)
		};
		default: return spec;
	}
}
function objectOf(fields, prefix, desc) {
	return {
		type: "object",
		properties: Object.fromEntries(Object.entries(fields).map(([k, s]) => [k, toJson(s, prefix + k, desc)])),
		required: Object.entries(fields).filter(([, s]) => !s.optional).map(([k]) => k)
	};
}
function fileSchema(resource, schema, name, spec) {
	let desc = describe(schema, name, texts(resource)), title = `${resource}/data/${name}.json`, body = spec.kind === "settings" ? (() => {
		let obj = objectOf(spec.sections, "", desc), required = obj.required.filter((k) => !(k in (spec.defaults ?? {})));
		return {
			...obj,
			properties: {
				$schema: SCHEMA_KEY,
				...obj.properties
			},
			required
		};
	})() : {
		type: "object",
		properties: { $schema: SCHEMA_KEY },
		patternProperties: { [spec.keyPattern ?? "^[a-z0-9_]{2,32}$"]: objectOf(spec.sections, "", desc) },
		additionalProperties: !1
	};
	return `${JSON.stringify({
		$schema: "http://json-schema.org/draft-07/schema#",
		title,
		...body
	}, null, 2)}\n`;
}
function writeSchema(resource, name, text, log) {
	let path = `data/schemas/${name}.schema.json`;
	if (LoadResourceFile(resource, path) === text) return;
	let dir = `${GetResourcePath(resource)}/data/schemas`;
	(0, node_fs_promises.mkdir)(dir, { recursive: !0 }).then(() => (0, node_fs_promises.writeFile)(`${dir}/${name}.schema.json`, text, "utf8")).catch((error) => log.error(`writing ${resource}/${path} failed`, error));
}
// ../../../packages/lib/src/server/admin/panel.ts
const core$27 = resourceExport(CORE.resource);
var AdminPanel = class {
	schema;
	data = new Map();
	dataFiles = new Map();
	handlers = new Map();
	rules = new Map();
	actions = new Map();
	views = new FileViews((file) => this.get(file));
	worldChanges = new Map();
	resource = GetCurrentResourceName();
	log = createLogger(this.resource);
	editor = 0;
	constructor(schema) {
		this.schema = schema;
		for (let [name, spec] of Object.entries(schema.files)) this.load(name, spec);
		registerExport("AdminPanelSnapshot", () => this.snapshot()), registerExport("AdminPanelData", () => this.dataSnapshot()), registerExport("AdminPanelSummary", () => this.summary()), registerExport("AdminPanelApply", (admin, patch) => this.apply(admin, patch)), onClientCallback(ADMIN.worldChangesCallback(this.resource), () => Object.fromEntries(this.worldChanges), { rate: {
			count: 4,
			windowMs: 1e4
		} }), setImmediate(() => core$27.RegisterAdminPanel(this.resource));
	}
	get(file) {
		return this.data.get(file) ?? {};
	}
	onChange(file, handler) {
		this.handlers.set(file, [...this.handlers.get(file) ?? [], handler]);
	}
	rule(file, rule) {
		this.rules.set(file, rule);
	}
	onAction(id, handler) {
		this.actions.set(id, handler);
	}
	view(file, read) {
		return this.views.view(file, read);
	}
	records(file, readOne) {
		return this.views.records(file, readOne);
	}
	snapshot() {
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data: this.dataSnapshot()
		};
	}
	dataSnapshot() {
		return clone(Object.fromEntries(this.data));
	}
	summary() {
		let data = {}, index = {};
		for (let [file, spec] of Object.entries(this.schema.files)) {
			let content = this.data.get(file);
			if (spec.kind !== "records") {
				data[file] = clone(content ?? {});
				continue;
			}
			let labels = {};
			for (let [key, record] of Object.entries(content ?? {})) labels[key] = labelOf(record, spec.labelPath) ?? key;
			index[file] = labels;
		}
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data,
			loaded: !1,
			index
		};
	}
	apply(admin, raw) {
		let patch = toPatch(raw), spec = patch ? this.schema.files[patch.file] : void 0;
		if (!patch || !spec) return {
			ok: !1,
			error: ERR.type
		};
		this.editor = admin;
		try {
			if (patch.action === "run") return this.run(admin, patch, spec);
			if (spec.memory) return {
				ok: !1,
				error: ERR.type
			};
			let error = checkEdit(patch, spec, {
				get: (file) => this.get(file),
				rule: (file) => this.rules.get(file)
			});
			return error ? (this.log.warn(`admin ${admin} edit refused (${error}): ${previewJson(patch, 300)}`), {
				ok: !1,
				error
			}) : (this.store(patch, spec), { ok: !0 });
		} finally {
			this.editor = 0;
		}
	}
	run(admin, patch, spec) {
		let handler = this.actions.get(patch.id), data = this.get(patch.file), target = spec.kind === "records" ? data[patch.key ?? ""] : data;
		if (!handler || !isRecord(target)) return {
			ok: !1,
			error: ERR.type
		};
		try {
			let error = handler(admin, clone(target), patch.key);
			return error ? {
				ok: !1,
				error
			} : { ok: !0 };
		} catch (error) {
			return this.log.error(`panel action ${patch.id} failed`, error), {
				ok: !1,
				error: ERR.type
			};
		}
	}
	commit(file, key, value) {
		let data = this.data.get(file);
		data && (key === void 0 ? isRecord(value) && this.data.set(file, clone(value)) : value === null ? delete data[key] : data[key] = clone(value), this.changed(file, key));
	}
	commitAfter(file, key, value) {
		setImmediate(() => this.commit(file, key, value));
	}
	store(patch, spec) {
		let data = this.data.get(patch.file) ?? {}, keys = applyEdit(data, patch, spec);
		if (keys.length !== 0) {
			this.data.set(patch.file, data);
			for (let key of keys) this.changed(patch.file, key);
		}
	}
	changed(file, key) {
		let spec = this.schema.files[file], data = this.get(file), value = key === void 0 ? data : data[key] ?? null;
		this.dataFiles.get(file)?.write(data), this.views.changed(file, key, value);
		for (let handler of this.handlers.get(file) ?? []) handler(key, value);
		if (core$27.AdminPanelChanged({
			resource: this.resource,
			file,
			key,
			value: clone(value)
		}), spec?.sync !== "all") return;
		let changes = this.worldChanges.get(file) ?? {};
		changes[key ?? ""] = clone(value), this.worldChanges.set(file, changes), emitNet(ADMIN.worldEvent(this.resource), -1, file, key ?? null, value);
	}
	load(name, spec) {
		if (spec.memory) {
			this.data.set(name, {});
			return;
		}
		let file = new DataFile(this.resource, name, this.log);
		this.dataFiles.set(name, file), file.schemaRef = `./schemas/${name}.schema.json`, writeSchema(this.resource, name, fileSchema(this.resource, this.schema, name, spec), this.log);
		let raw = file.read(), data = isRecord(raw) ? raw : {}, filled = !1;
		if (spec.kind === "settings") for (let [section, value] of Object.entries(spec.defaults ?? {})) section in data || (data[section] = clone(value), filled = !0);
		this.data.set(name, data), (filled || raw === null || !file.hasSchemaRef()) && file.write(data);
	}
};
function labelOf(record, path) {
	if (!path) return null;
	let at = record;
	for (let part of path.split(".")) {
		if (typeof at != "object" || !at) return null;
		at = at[part];
	}
	return typeof at == "string" && at !== "" ? at : null;
}
// ../../../packages/lib/src/server/log.ts
function aiLog(channel, message, options) {
	optionalExport("ai-core")?.Log(channel, message, options);
}
function aiLogChannels(channels) {
	optionalExport("ai-core")?.LogChannels(channels);
}
// ../../../packages/lib/src/server/notify.ts
function notify(source, text, kind = "info", duration, title) {
	let notification = {
		text,
		kind,
		duration,
		title
	};
	emitNet(LIB_UI.notifyEvent, source, notification);
}
// ../../../packages/lib/src/server/inventory.ts
const core$26 = resourceExport(CORE.resource), inventory = {
	addItem: (inv, item, count = 1, metadata, slot) => core$26.AddItem(inv, item, count, metadata, slot),
	removeItem: (inv, item, count = 1, metadata, slot) => core$26.RemoveItem(inv, item, count, metadata, slot),
	getItemCount: (inv, item, metadata) => core$26.GetItemCount(inv, item, metadata),
	hasItem: (inv, item, count = 1) => core$26.HasItem(inv, item, count),
	canCarryItem: (inv, item, count = 1, metadata) => core$26.CanCarryItem(inv, item, count, metadata),
	getItems: (inv) => core$26.GetItems(inv),
	clearInventory: (inv) => core$26.ClearInventory(inv),
	registerStash: (name, label, slots, maxWeight, jobs = []) => core$26.RegisterStash(name, label, slots, maxWeight, jobs),
	openInventory: (source, inv) => core$26.OpenInventory(source, inv),
	registerUsableItem: (name, handler) => core$26.RegisterUsableItem(name, handler),
	registerShop: (name, label, items) => core$26.RegisterShop(name, label, items),
	openShop: (source, name) => core$26.OpenShop(source, name),
	getItemDefinition: (name) => core$26.GetItemDefinition(name),
	setItemMetadata: (inv, slot, metadata) => core$26.SetItemMetadata(inv, slot, metadata),
	setMaxWeight: (source, grams) => core$26.SetMaxWeight(source, grams),
	usableItems: () => core$26.GetUsableItems()
}, core$25 = resourceExport(CORE.resource);
function reindex(index, source, before, after) {
	for (let name of before) {
		let set = index.get(name);
		set && (set.delete(source), set.size === 0 && index.delete(name));
	}
	for (let name of after) {
		let set = index.get(name);
		set || index.set(name, set = new Set()), set.add(source);
	}
}
var OnlinePlayers = class {
	players = new Map();
	onDuty = new Map();
	jobIndex = new Map();
	gangIndex = new Map();
	started = !1;
	start() {
		if (this.started) return;
		this.started = !0;
		let load = (source, character) => {
			this.drop(source), this.players.set(source, {
				character,
				jobs: [],
				jobNames: [],
				gangs: [],
				gangNames: [],
				duty: null
			}), this.setJobs(source, core$25.GetJobs(source) ?? []), this.setGangs(source, core$25.GetGangs(source) ?? []), this.setDuty(source, core$25.GetDutyJob(source));
		};
		on(CORE.playerLoadedEvent, load), on(CORE.playerUnloadedEvent, (source) => this.drop(source)), on(CORE.jobsChangedEvent, (source, jobs) => this.setJobs(source, jobs)), on(CORE.gangsChangedEvent, (source, gangs) => this.setGangs(source, gangs)), on(CORE.dutyChangedEvent, (source, job) => this.setDuty(source, job));
		for (let source of core$25.GetLoadedSources()) {
			let character = core$25.GetCharacter(source);
			character && load(source, character);
		}
	}
	drop(source) {
		let player = this.players.get(source);
		player && (this.setDuty(source, null), reindex(this.jobIndex, source, player.jobNames, []), reindex(this.gangIndex, source, player.gangNames, []), this.players.delete(source));
	}
	setJobs(source, jobs) {
		let player = this.players.get(source);
		if (!player) return;
		let names = jobs.map((m) => m.job);
		reindex(this.jobIndex, source, player.jobNames, names), player.jobs = jobs, player.jobNames = names;
	}
	setGangs(source, gangs) {
		let player = this.players.get(source);
		if (!player) return;
		let names = gangs.map((m) => m.gang);
		reindex(this.gangIndex, source, player.gangNames, names), player.gangs = gangs, player.gangNames = names;
	}
	setDuty(source, job) {
		let player = this.players.get(source);
		if (!player) return;
		if (player.duty) {
			let set = this.onDuty.get(player.duty);
			set?.delete(source), set?.size === 0 && this.onDuty.delete(player.duty);
		}
		if (player.duty = job, !job) return;
		let set = this.onDuty.get(job);
		set || this.onDuty.set(job, set = new Set()), set.add(source);
	}
	sources() {
		return this.start(), this.players.keys();
	}
	get size() {
		return this.start(), this.players.size;
	}
	character(source) {
		return this.start(), this.players.get(source)?.character ?? null;
	}
	charId(source) {
		return this.start(), this.players.get(source)?.character.id;
	}
	name(source, options = {}) {
		let c = this.character(source);
		return c ? `${c.firstname} ${c.lastname}` : options.fallback === !1 ? "" : GetPlayerName(String(source));
	}
	jobs(source) {
		return this.start(), this.players.get(source)?.jobNames ?? [];
	}
	gangs(source) {
		return this.start(), this.players.get(source)?.gangNames ?? [];
	}
	jobGrade(source, job) {
		return this.start(), this.players.get(source)?.jobs.find((m) => m.job === job)?.grade ?? null;
	}
	gangGrade(source, gang) {
		return this.start(), this.players.get(source)?.gangs.find((m) => m.gang === gang)?.grade ?? null;
	}
	jobMembers(job) {
		return this.start(), this.jobIndex.get(job) ?? EMPTY;
	}
	gangMembers(gang) {
		return this.start(), this.gangIndex.get(gang) ?? EMPTY;
	}
	dutyJob(source) {
		return this.start(), this.players.get(source)?.duty ?? null;
	}
	onDutyIn(source, jobs) {
		let duty = this.dutyJob(source);
		return duty !== null && jobs.includes(duty);
	}
	allows(source, rule) {
		if (isPublic(rule)) return !0;
		let min = (name) => rule.grades[name] ?? 0;
		for (let gang of rule.gangs) {
			let grade = this.gangGrade(source, gang);
			if (grade !== null && grade >= min(gang)) return !0;
		}
		let duty = rule.onDuty ? this.dutyJob(source) : null;
		for (let job of rule.jobs) {
			let grade = this.jobGrade(source, job);
			if (grade !== null && grade >= min(job) && (!rule.onDuty || duty === job)) return !0;
		}
		return !1;
	}
	countOnDuty(jobs) {
		this.start();
		let count = 0;
		for (let job of jobs) count += this.onDuty.get(job)?.size ?? 0;
		return count;
	}
	onDutyFor(job) {
		return this.start(), this.onDuty.get(job) ?? EMPTY;
	}
};
const EMPTY = new Set(), online = new OnlinePlayers(), core$24 = resourceExport(CORE.resource), vehicleKeys = {
	give: (source, vehicle, purpose = "temporary") => core$24.GiveVehicleKeys(source, vehicle, purpose),
	remove: (source, vehicle) => core$24.RemoveVehicleKeys(source, vehicle),
	has: (source, vehicle) => core$24.HasVehicleKeys(source, vehicle)
}, core$23 = resourceExport(CORE.resource), fuel = {
	get: (vehicle) => core$23.GetVehicleFuel(vehicle),
	set: (vehicle, level) => core$23.SetVehicleFuel(vehicle, level),
	provider: () => core$23.GetFuelSystem()
}, TYPES = new Set([
	"automobile",
	"bike",
	"boat",
	"heli",
	"plane",
	"submarine",
	"trailer",
	"train"
]), types = new Map(), votes = new Map(), modelHash = (model) => typeof model == "number" ? model | 0 : GetHashKey(model) | 0;
async function vehicleType(model, asker) {
	let hash = modelHash(model), known = types.get(hash);
	if (known !== void 0) return known;
	let answer = await triggerClientCallback(CORE.vehicleTypeCallback, asker, [model]).catch(() => null);
	if (typeof answer != "string" || !TYPES.has(answer)) return null;
	let seen = votes.get(hash) ?? new Map(), first = seen.get(answer);
	return first !== void 0 && first !== asker ? (types.set(hash, answer), votes.delete(hash)) : (seen.set(answer, asker), votes.set(hash, seen)), answer;
}
async function seatPlayer(vehicle, source, seat) {
	let ped = GetPlayerPed(String(source));
	return ped ? waitFor(() => {
		if (!DoesEntityExist(vehicle)) return !1;
		if (GetPedInVehicleSeat(vehicle, seat) === ped) return !0;
		SetPedIntoVehicle(ped, vehicle, seat);
	}, 2e3, 150).catch(() => !1) : !1;
}
function randomPlate(prefix) {
	let digit = () => String(Math.floor(Math.random() * 10));
	if (prefix !== void 0) {
		let plate = prefix.slice(0, 8);
		for (; plate.length < 8;) plate += digit();
		return plate;
	}
	let letter = () => "ABCDEFGHJKLMNPRSTUVWXYZ"[Math.floor(Math.random() * 23)] ?? "A";
	return `${digit()}${digit()}${letter()}${letter()}${letter()}${digit()}${digit()}${digit()}`;
}
async function spawnVehicle(options) {
	let type = options.asker === void 0 ? options.type ?? "automobile" : await vehicleType(options.model, options.asker);
	if (!type) return null;
	let { x, y, z, heading } = options.coords, vehicle = CreateVehicleServerSetter(modelHash(options.model), type, x, y, z, heading);
	if (!await waitFor(() => DoesEntityExist(vehicle) || void 0, 5e3).catch(() => !1)) return null;
	options.persistent !== !1 && SetEntityOrphanMode(vehicle, 2);
	let plate = (options.plate ?? randomPlate()).slice(0, 8);
	SetVehicleNumberPlateText(vehicle, plate), options.bucket !== void 0 && SetEntityRoutingBucket(vehicle, options.bucket), options.locked && SetVehicleDoorsLocked(vehicle, 2);
	let state = Entity(vehicle).state;
	options.fuel !== void 0 && fuel.set(vehicle, options.fuel), options.props && state.set(VEHICLE_BAGS.props, options.props, !0), options.setup && state.set(VEHICLE_BAGS.setup, options.setup, !0);
	for (let [key, value] of Object.entries(options.bags ?? {})) state.set(key, value, !0);
	if (options.keysTo !== void 0) {
		let synced = await waitFor(() => !DoesEntityExist(vehicle) || GetVehicleNumberPlateText(vehicle).trim() === plate.trim() || void 0, 3e3).catch(() => !1);
		vehicleKeys.give(options.keysTo, synced && DoesEntityExist(vehicle) ? vehicle : plate.trim(), options.purpose ?? "temporary");
	}
	let riders = [...options.driver === void 0 ? [] : [{
		source: options.driver,
		seat: -1
	}], ...options.seats ?? []];
	return await Promise.all(riders.map((r) => seatPlayer(vehicle, r.source, r.seat))), vehicle;
}
resourceExport(CORE.resource);
// ../../../packages/lib/src/server/players.ts
const log$4 = createLogger(GetCurrentResourceName()), dropped = new Set();
let listening$1 = !1;
function onDropped(fn) {
	listening$1 || (listening$1 = !0, on("playerDropped", () => {
		let source = Number(globalThis.source);
		for (let handler of dropped) handler(source);
	})), dropped.add(fn);
}
var PlayerMap = class extends Map {
	constructor(options = {}) {
		super(), onDropped((source) => {
			if (!this.has(source)) return;
			let value = this.get(source);
			this.delete(source), options.onDrop?.(source, value);
		});
	}
};
function onCharacter(handlers) {
	let live = new Map(), deliver = (source, character) => {
		if (live.set(source, character.id), handlers.loaded) try {
			let result = handlers.loaded(source, character);
			result instanceof Promise && result.catch((error) => log$4.error(`character loaded handler failed for ${source}`, error));
		} catch (error) {
			log$4.error(`character loaded handler failed for ${source}`, error);
		}
	}, end = (source, charId, reason) => {
		if (live.delete(source)) try {
			handlers.unloaded?.(source, charId, reason);
		} catch (error) {
			log$4.error(`character unloaded handler failed for ${source}`, error);
		}
	};
	on(CORE.playerLoadedEvent, (source, character) => {
		let previous = live.get(source);
		previous !== void 0 && end(source, previous, "switch"), deliver(source, character);
	}), on(CORE.playerUnloadedEvent, (source, charId, reason) => end(source, charId, reason === "dropped" ? "dropped" : "switch")), onDropped((source) => setImmediate(() => {
		let charId = live.get(source);
		charId !== void 0 && end(source, charId, "dropped");
	})), setImmediate(() => {
		for (let source of online.sources()) {
			if (live.has(source)) continue;
			let character = online.character(source);
			character && deliver(source, character);
		}
	});
}
// ../../../packages/lib/src/server/areaStream.ts
var AreaStream = class {
	options;
	items = new Map();
	cells = new Map();
	followers = new PlayerMap({ onDrop: (source, f) => this.leave(source, f) });
	inCell = new Map();
	alsoOf = new PlayerMap({ onDrop: (_source, entries) => {
		for (let entry of entries) entry.also = void 0;
	} });
	size_;
	range;
	chunk;
	stale = !1;
	constructor(options) {
		this.options = options, this.size_ = options.cellSize ?? 64, this.range = options.range ?? 1, this.chunk = options.chunk ?? 50;
	}
	get size() {
		return this.items.size;
	}
	get(id) {
		return this.items.get(id)?.item;
	}
	*values() {
		for (let entry of this.items.values()) yield entry.item;
	}
	cellOf(x, y) {
		return gridCell(x, y, this.size_);
	}
	countAt(x, y) {
		let { cx, cy } = this.cellOf(x, y);
		return this.cells.get(cellKey(cx, cy))?.size ?? 0;
	}
	*around(x, y, cells = 1) {
		let { cx, cy } = this.cellOf(x, y);
		for (let dx = -cells; dx <= cells; dx++) for (let dy = -cells; dy <= cells; dy++) for (let entry of this.cells.get(cellKey(cx + dx, cy + dy)) ?? []) yield entry.item;
	}
	set(item, resend = !0) {
		this.stale && this.followAll();
		let { cx, cy } = this.cellOf(item.x, item.y), also = this.options.alsoTo?.(item), entry = this.items.get(item.id);
		if (!entry) {
			let fresh = {
				item,
				cx,
				cy,
				also: void 0
			};
			this.items.set(item.id, fresh), this.file(fresh), this.setAlso(fresh, also);
			let put = [this.options.view(item)];
			for (let source of this.who(cx, cy, also)) this.send(source, put, []);
			return;
		}
		let before = this.who(entry.cx, entry.cy, entry.also);
		(entry.cx !== cx || entry.cy !== cy) && (this.unfile(entry), entry.cx = cx, entry.cy = cy, this.file(entry)), entry.item = item, this.setAlso(entry, also);
		let after = this.who(cx, cy, also), gone = [item.id];
		for (let source of before) after.has(source) || this.send(source, [], gone);
		let put = [this.options.view(item)];
		for (let source of after) (resend || !before.has(source)) && this.send(source, put, []);
	}
	delete(id) {
		let entry = this.items.get(id);
		if (!entry) return;
		this.items.delete(id), this.unfile(entry);
		let gone = [id];
		for (let source of this.who(entry.cx, entry.cy, entry.also)) this.send(source, [], gone);
		this.setAlso(entry, void 0);
	}
	load(items) {
		for (let item of items) {
			let old = this.items.get(item.id);
			old && (this.unfile(old), this.setAlso(old, void 0));
			let { cx, cy } = this.cellOf(item.x, item.y), entry = {
				item,
				cx,
				cy,
				also: void 0
			};
			this.items.set(item.id, entry), this.file(entry), this.setAlso(entry, this.options.alsoTo?.(item));
		}
		for (let [source, f] of this.followers) this.snapshot(source, f);
	}
	recipients(id) {
		let entry = this.items.get(id);
		return entry ? this.who(entry.cx, entry.cy, entry.also) : new Set();
	}
	knows(source, id) {
		let entry = this.items.get(id);
		if (!entry) return !1;
		if (entry.also === source) return !0;
		let f = this.followers.get(source);
		return f !== void 0 && Math.abs(f.cx - entry.cx) <= this.range && Math.abs(f.cy - entry.cy) <= this.range;
	}
	start(source, at = coordsOf(source)) {
		let { cx, cy } = this.cellOf(at.x, at.y), old = this.followers.get(source);
		old && this.leave(source, old);
		let f = {
			cx,
			cy
		};
		this.followers.set(source, f), this.enter(source, f), this.snapshot(source, f);
	}
	follow(source, cx, cy) {
		let f = this.followers.get(source);
		if (!f) {
			let fresh = {
				cx,
				cy
			};
			return this.followers.set(source, fresh), this.enter(source, fresh), this.snapshot(source, fresh);
		}
		this.move(source, f, cx, cy);
	}
	followReported(source, cx, cy) {
		let p = coordsOf(source), real = this.cellOf(p.x, p.y);
		return Math.abs(real.cx - cx) > 1 || Math.abs(real.cy - cy) > 1 ? !1 : (this.follow(source, cx, cy), !0);
	}
	followAll() {
		if (this.items.size === 0) this.stale = !0;
		else {
			this.stale = !1;
			for (let [source, f] of this.followers) {
				let p = coordsOf(source), { cx, cy } = this.cellOf(p.x, p.y);
				this.move(source, f, cx, cy);
			}
		}
	}
	stop(source, tell = !1) {
		let f = this.followers.get(source);
		f && (this.followers.delete(source), this.leave(source, f), tell && this.emit(source, !0, [], []));
	}
	following(source) {
		return this.followers.has(source);
	}
	move(source, f, cx, cy) {
		if (f.cx === cx && f.cy === cy) return;
		let r = this.range, removes = [], puts = [];
		for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
			let ox = f.cx + dx, oy = f.cy + dy;
			if (Math.abs(ox - cx) > r || Math.abs(oy - cy) > r) for (let entry of this.cells.get(cellKey(ox, oy)) ?? []) entry.also !== source && removes.push(entry.item.id);
			let nx = cx + dx, ny = cy + dy;
			if (Math.abs(nx - f.cx) > r || Math.abs(ny - f.cy) > r) for (let entry of this.cells.get(cellKey(nx, ny)) ?? []) entry.also !== source && puts.push(this.options.view(entry.item));
		}
		this.leave(source, f), f.cx = cx, f.cy = cy, this.enter(source, f), (puts.length > 0 || removes.length > 0) && this.send(source, puts, removes);
	}
	snapshot(source, f) {
		let puts = [], r = this.range;
		for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let entry of this.cells.get(cellKey(f.cx + dx, f.cy + dy)) ?? []) puts.push(this.options.view(entry.item));
		for (let entry of this.alsoOf.get(source) ?? []) (Math.abs(entry.cx - f.cx) > r || Math.abs(entry.cy - f.cy) > r) && puts.push(this.options.view(entry.item));
		this.emit(source, !0, puts, []);
	}
	who(cx, cy, also) {
		let out = new Set(), r = this.range;
		for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let source of this.inCell.get(cellKey(cx + dx, cy + dy)) ?? []) out.add(source);
		return also !== void 0 && out.add(also), out;
	}
	send(source, puts, removes) {
		this.emit(source, !1, puts, removes);
	}
	emit(source, reset, puts, removes) {
		let extra = this.options.extra?.() ?? [], { event } = this.options;
		emitNet(event, source, reset, puts.slice(0, this.chunk), removes, ...extra);
		for (let i = this.chunk; i < puts.length; i += this.chunk) emitNet(event, source, !1, puts.slice(i, i + this.chunk), [], ...extra);
	}
	setAlso(entry, also) {
		if (entry.also === also) return;
		if (entry.also !== void 0) {
			let set = this.alsoOf.get(entry.also);
			set?.delete(entry), set?.size === 0 && this.alsoOf.delete(entry.also);
		}
		if (entry.also = also, also === void 0) return;
		let set = this.alsoOf.get(also);
		set || this.alsoOf.set(also, set = new Set()), set.add(entry);
	}
	file(entry) {
		let key = cellKey(entry.cx, entry.cy), set = this.cells.get(key);
		set || this.cells.set(key, set = new Set()), set.add(entry);
	}
	unfile(entry) {
		let key = cellKey(entry.cx, entry.cy), set = this.cells.get(key);
		set?.delete(entry), set?.size === 0 && this.cells.delete(key);
	}
	enter(source, f) {
		let key = cellKey(f.cx, f.cy), set = this.inCell.get(key);
		set || this.inCell.set(key, set = new Set()), set.add(source);
	}
	leave(source, f) {
		let key = cellKey(f.cx, f.cy), set = this.inCell.get(key);
		set?.delete(source), set?.size === 0 && this.inCell.delete(key);
	}
};
// ../../../packages/lib/src/server/progressFor.ts
const running = new PlayerMap({ onDrop: (_source, settle) => settle(!1) });
on(CORE.playerUnloadedEvent, (source) => {
	let settle = running.get(source);
	settle && settle(!1);
});
function progressFor(source, options) {
	let previous = running.get(source);
	previous && (previous(!1), emitNet(LIB_UI.progressForCancelEvent, source));
	let { minRatio = .8, ...bar } = options, startedAt = GetGameTimer();
	return new Promise((resolve) => {
		let done = !1, settle = (ok) => {
			done || (done = !0, running.get(source) === settle && running.delete(source), resolve(ok));
		};
		running.set(source, settle), triggerClientCallback(LIB_UI.progressForCallback, source, [bar], bar.duration + 15e3).then((answer) => settle(answer === !0 && GetGameTimer() - startedAt >= bar.duration * minRatio), () => settle(!1));
	});
}
// ../../../packages/lib/src/server/definitions.ts
const core$21 = resourceExport("ai-core");
new class {
	jobs = new Map();
	gangs = new Map();
	constructor() {
		on(CORE.definitionsChangedEvent, (file, name) => {
			typeof name == "string" && (file === "jobs" ? this.jobs.delete(name) : file === "gangs" && this.gangs.delete(name));
		});
	}
	job(name) {
		let def = this.jobs.get(name);
		return def === void 0 && this.jobs.set(name, def = core$21.GetJobDefinition(name) ?? null), def;
	}
	registerJob(name, definition) {
		return core$21.RegisterJobDefinition(name, definition);
	}
	removeJob(name) {
		return core$21.RemoveJobDefinition(name);
	}
	registerGang(name, definition) {
		return core$21.RegisterGangDefinition(name, definition);
	}
	removeGang(name) {
		return core$21.RemoveGangDefinition(name);
	}
	gang(name) {
		let def = this.gangs.get(name);
		return def === void 0 && this.gangs.set(name, def = core$21.GetGangDefinition(name) ?? null), def;
	}
}();
async function minigameFor(source, options) {
	let level = options.difficulty ?? "medium", request = options.game === "lockpick" ? {
		kind: "lockpick",
		pins: Math.min(6, Math.max(1, Math.floor(options.pins ?? 1))),
		area: LOCKPICK_AREAS[level],
		picks: Math.min(10, Math.max(1, Math.floor(options.picks ?? 1)))
	} : {
		kind: "skillCheck",
		stages: Array.from({ length: Math.min(10, Math.max(1, options.rounds ?? 2)) }, () => SKILL_STAGES[level]),
		keys: options.keys ?? ["e"]
	}, startedAt = GetGameTimer(), answer = await triggerClientCallback(LIB_UI.minigameForCallback, source, [request], 12e4).catch(() => null);
	return answer === !0 || answer === "opened" ? GetGameTimer() - startedAt < (options.minMs ?? 0) ? "lost" : "won" : answer === "broken" ? "broken" : "lost";
}
// ../../../packages/lib/src/server/command.ts
const resource = GetCurrentResourceName();
createLogger(resource), new class {
	list = [];
	sent = new Map();
	announced = 0;
	queued = !1;
	listening = !1;
	add(command) {
		this.listening || this.listen(), this.list.push(command), this.queued || (this.queued = !0, setImmediate(() => this.flush()));
	}
	refresh(source) {
		let before = this.sent.get(source), now = new Set(), add = [];
		for (let command of this.list) for (let name of command.info.names) command.allowed(source, name) && (now.add(name), before?.has(name) || add.push(command.suggestion(name)));
		if (this.sent.set(source, now), add.length && emitNet("chat:addSuggestions", source, add), before) for (let name of before) now.has(name) || emitNet("chat:removeSuggestion", source, `/${name}`);
	}
	flush() {
		this.queued = !1, optionalExport(CORE.resource)?.RegisterCommands(resource, this.list.slice(this.announced).map((c) => c.info)), this.announced = this.list.length;
		for (let player of getPlayers()) this.refresh(Number(player));
	}
	listen() {
		this.listening = !0;
		let refresh = (source) => this.refresh(Number(source));
		on(CORE.playerLoadedEvent, refresh), on(CORE.jobsChangedEvent, refresh), on(CORE.gangsChangedEvent, refresh), on("playerDropped", () => this.sent.delete(Number(globalThis.source))), on("onResourceStop", (name) => {
			if (name === resource) for (let command of this.list) for (let n of command.info.names) emitNet("chat:removeSuggestion", -1, `/${n}`);
		});
	}
}(), createLogger(GetCurrentResourceName()), createLogger("aicore-lib");
// ../../../packages/lib/src/fivem/byResource.ts
const stopHandlers = [];
let listening = !1;
function onAnyStop(handler) {
	if (stopHandlers.push(handler), listening) return;
	listening = !0;
	let event = IsDuplicityVersion() ? "onResourceStop" : "onClientResourceStop";
	on(event, (resource) => {
		for (let stop of stopHandlers) stop(resource);
	});
}
function onStop(fn) {
	let self = GetCurrentResourceName();
	onAnyStop((resource) => {
		resource === self && fn();
	});
}
let log = null;
var ScheduledJob = class {
	interval;
	fn;
	name;
	gen = 0;
	active = !1;
	stopped = !1;
	quietUntil = 0;
	skipped = 0;
	constructor(interval, fn, name) {
		this.interval = interval, this.fn = fn, this.name = name;
	}
	get running() {
		return this.active;
	}
	set(active) {
		active === this.active || active && this.stopped || (this.active = active, active ? scheduler.activate(this) : scheduler.deactivate(this));
	}
	stop() {
		this.set(!1), this.stopped = !0;
	}
	call() {
		try {
			let result = this.fn();
			result instanceof Promise && result.catch((error) => this.fail(error));
		} catch (error) {
			this.fail(error);
		}
	}
	fail(error) {
		let now = GetGameTimer();
		if (now < this.quietUntil) {
			this.skipped++;
			return;
		}
		this.quietUntil = now + 1e4;
		let more = this.skipped ? ` (+${this.skipped} more)` : "";
		this.skipped = 0, log ??= createLogger(GetCurrentResourceName()), log.error(`job "${this.name}" failed${more}`, error instanceof Error ? error.stack ?? error.message : error);
	}
}, Group = class {
	interval;
	jobs = Array(8);
	gens = Array(8).fill(0);
	dues = Array(8).fill(0);
	head = 0;
	mask = 7;
	count = 0;
	constructor(interval) {
		this.interval = interval;
	}
	get front() {
		return this.dues[this.head] ?? 0;
	}
	compactAt = 64;
	push(job, due) {
		this.count >= this.compactAt && this.compact(), this.count > this.mask && this.grow();
		let i = this.head + this.count & this.mask;
		this.jobs[i] = job, this.gens[i] = job.gen, this.dues[i] = due, this.count++;
	}
	run(now) {
		for (let left = this.count; left > 0 && this.count > 0; left--) {
			let i = this.head, due = this.dues[i] ?? 0;
			if (due > now) return;
			let job = this.jobs[i], gen = this.gens[i];
			if (this.jobs[i] = void 0, this.head = i + 1 & this.mask, this.count--, !job || job.gen !== gen) continue;
			let next = due + this.interval;
			next <= now && (next = now + this.interval), this.push(job, next), job.call();
		}
	}
	compact() {
		let kept = 0;
		for (let n = 0; n < this.count; n++) {
			let i = this.head + n & this.mask, job = this.jobs[i];
			if (!job || job.gen !== this.gens[i]) continue;
			let k = this.head + kept & this.mask;
			this.jobs[k] = job, this.gens[k] = this.gens[i] ?? 0, this.dues[k] = this.dues[i] ?? 0, kept++;
		}
		for (let n = kept; n < this.count; n++) this.jobs[this.head + n & this.mask] = void 0;
		this.count = kept, this.compactAt = Math.max(64, kept * 2);
	}
	grow() {
		let size = (this.mask + 1) * 2, jobs = Array(size), gens = Array(size).fill(0), dues = Array(size).fill(0);
		for (let n = 0; n < this.count; n++) {
			let i = this.head + n & this.mask;
			jobs[n] = this.jobs[i], gens[n] = this.gens[i] ?? 0, dues[n] = this.dues[i] ?? 0;
		}
		this.jobs = jobs, this.gens = gens, this.dues = dues, this.head = 0, this.mask = size - 1;
	}
};
const scheduler = new class {
	groups = [];
	byInterval = new Map();
	tick = null;
	active = 0;
	nextDue = Infinity;
	running = !1;
	activate(job) {
		job.gen++, this.active++;
		let due = GetGameTimer() + job.interval, group = this.byInterval.get(job.interval);
		group || (group = new Group(job.interval), this.byInterval.set(job.interval, group), this.groups.push(group)), group.push(job, due), due < this.nextDue && (this.nextDue = due), this.tick ??= setTick(this.onTick);
	}
	deactivate(job) {
		job.gen++, this.active--, this.active === 0 && !this.running && this.halt();
	}
	halt() {
		this.tick !== null && clearTick(this.tick), this.tick = null, this.groups.length = 0, this.byInterval.clear(), this.nextDue = Infinity;
	}
	onTick = () => {
		let now = GetGameTimer();
		if (now < this.nextDue) return;
		let groups = this.groups;
		this.running = !0;
		for (let i = 0; i < groups.length; i++) {
			let group = groups[i];
			group && group.count > 0 && group.front <= now && group.run(now);
		}
		if (this.running = !1, this.active === 0) return this.halt();
		let soonest = Infinity, kept = 0;
		for (let i = 0; i < groups.length; i++) {
			let group = groups[i];
			group && (group.count === 0 ? this.byInterval.delete(group.interval) : (groups[kept++] = group, group.front < soonest && (soonest = group.front)));
		}
		groups.length = kept, this.nextDue = soonest;
	};
}();
function every(ms, fn, options = {}) {
	let job = new ScheduledJob(Math.max(0, Math.floor(ms)), fn, options.name ?? (fn.name || "anonymous"));
	return options.active !== !1 && job.set(!0), job;
}
IsDuplicityVersion(), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource);
// ../../../packages/lib/src/server/index.ts
function isOnline(source) {
	return !!GetPlayerName(String(source));
}
// resource/common/locale.ts
const Locale = createLocale();
GetCurrentResourceName(), IsDuplicityVersion();
// resource/common/routes.ts
const EVENTS = {
	start: "ai-jobs:start",
	stop: "ai-jobs:stop",
	arrive: "ai-jobs:arrive",
	shift: "ai-jobs:client:shift",
	attach: "ai-jobs:client:attach"
}, DEFAULT_TOW_MODELS = [
	"asea",
	"premier",
	"emperor",
	"blista",
	"ingot",
	"stanier",
	"washington",
	"oracle"
], KIND_SPRITE = {
	ordered: 67,
	random: 67,
	gather: 478,
	tow: 68
}, KINDS = [
	"ordered",
	"random",
	"gather",
	"tow"
];
function readRoute(id, v) {
	let d = record(v.depot), kind = KINDS.includes(v.kind) ? v.kind : "random", gatherMin = int(v.gatherMin, 1, 1, 100), towModels = Array.isArray(v.towModels) ? v.towModels.filter((m) => typeof m == "string") : [], blip = record(v.blip);
	return {
		ped: readPlacePed(v.ped),
		id,
		label: str(v.label, id, 48),
		kind,
		access: readAccess(v),
		depot: {
			x: num$1(d.x, 0),
			y: num$1(d.y, 0),
			z: num$1(d.z, 0)
		},
		vehicle: str(v.vehicle, "", 32),
		spawn: vec4(v.spawn, {
			x: num$1(d.x, 0),
			y: num$1(d.y, 0),
			z: num$1(d.z, 0),
			heading: 0
		}),
		pay: int(v.pay, 0, 0, 1e5),
		account: str(v.account, "bank", 32) || "bank",
		seconds: int(v.seconds, 5, 0, 120),
		item: str(v.item, "", 48),
		stops: int(v.stops, 0, 0, 100),
		gatherMin,
		gatherMax: Math.max(gatherMin, int(v.gatherMax, 3, 1, 100)),
		towModels: towModels.length ? towModels : DEFAULT_TOW_MODELS,
		blip: readBlipStyle(blip, {
			sprite: KIND_SPRITE[kind],
			color: 5,
			scale: .65
		})
	};
}
function readStop(id, v) {
	let c = record(v.coords), route = str(v.route, "", 32);
	return route === "" ? null : {
		id,
		route,
		label: str(v.label, id, 48),
		x: num$1(c.x, 0),
		y: num$1(c.y, 0),
		z: num$1(c.z, 0)
	};
}
// resource/server/hotdogSchema.ts
const price = {
	type: "number",
	min: 0,
	max: 1e4,
	integer: !0
}, account = {
	type: "text",
	lookup: "account",
	min: 2,
	max: 32,
	pattern: "^[a-z0-9_]{2,32}$"
}, HOTDOG_FILE = {
	kind: "settings",
	sync: "all",
	sections: {
		enabled: { type: "bool" },
		...ACCESS_FIELDS,
		coords: { type: "vec3" },
		ped: PLACE_PED_SPEC,
		blip: {
			type: "object",
			fields: BLIP_STYLE_FIELDS
		},
		spawn: { type: "vec4" },
		model: {
			type: "text",
			min: 2,
			max: 64
		},
		deposit: {
			type: "number",
			min: 0,
			max: 1e6,
			integer: !0
		},
		depositAccount: account,
		payAccount: account,
		checks: {
			type: "number",
			min: 1,
			max: 10,
			integer: !0
		},
		repGain: {
			type: "object",
			fields: {
				exotic: {
					type: "number",
					min: 0,
					max: 100,
					integer: !0
				},
				rare: {
					type: "number",
					min: 0,
					max: 100,
					integer: !0
				},
				common: {
					type: "number",
					min: 0,
					max: 100,
					integer: !0
				}
			}
		},
		maxRep: {
			type: "number",
			min: 0,
			max: 1e5,
			integer: !0
		},
		levels: {
			type: "list",
			min: 1,
			max: 10,
			of: {
				type: "object",
				fields: {
					rep: {
						type: "number",
						min: 0,
						max: 1e5,
						integer: !0
					},
					stock: {
						type: "number",
						min: 1,
						max: 1e3,
						integer: !0
					},
					exoticMin: price,
					exoticMax: price,
					rareMin: price,
					rareMax: price,
					commonMin: price,
					commonMax: price
				}
			}
		}
	}
}, NEW_LEVEL = {
	rep: 0,
	stock: 15,
	exoticMin: 8,
	exoticMax: 12,
	rareMin: 6,
	rareMax: 9,
	commonMin: 4,
	commonMax: 6
}, num = (path, key, max, unit) => ({
	widget: "number",
	path,
	label: `ADMIN_F_HD_${key}`,
	hint: `ADMIN_H_HD_${key}`,
	min: 0,
	max,
	...unit ? { unit } : {}
}), priceRow = (path, key) => ({
	widget: "number",
	path,
	label: `ADMIN_F_HD_${key}`,
	min: 0,
	max: 1e4,
	unit: "$"
}), HOTDOG_TAB = {
	id: "hotdog",
	file: "hotdog",
	icon: "utensils",
	label: "ADMIN_TAB_HOTDOG",
	desc: "ADMIN_TAB_HOTDOG_DESC",
	cards: [
		{
			icon: "store",
			title: "ADMIN_C_HD_STAND",
			desc: "ADMIN_C_HD_STAND_DESC",
			fields: [
				{
					widget: "switch",
					path: "enabled",
					label: "ADMIN_F_HD_ENABLED",
					hint: "ADMIN_H_HD_ENABLED"
				},
				{
					widget: "point",
					path: "coords",
					label: "ADMIN_F_HD_COORDS",
					hint: "ADMIN_H_HD_COORDS",
					ground: !0
				},
				{
					widget: "point",
					path: "spawn",
					label: "ADMIN_F_HD_SPAWN",
					hint: "ADMIN_H_HD_SPAWN",
					heading: !0,
					ground: !0
				},
				{
					widget: "model",
					kind: "object",
					path: "model",
					label: "ADMIN_F_HD_MODEL",
					placeholder: "ADMIN_P_HD_MODEL"
				},
				...accessFields(),
				{
					widget: "blip",
					path: "blip",
					label: "ADMIN_F_HD_BLIP"
				}
			]
		},
		{
			icon: "money-bill-wave",
			title: "ADMIN_C_HD_MONEY",
			desc: "ADMIN_C_HD_MONEY_DESC",
			fields: [
				num("deposit", "DEPOSIT", 1e6, "$"),
				{
					widget: "text",
					lookup: "account",
					path: "depositAccount",
					label: "ADMIN_F_HD_DEPOSIT_ACCOUNT",
					hint: "ADMIN_H_HD_DEPOSIT_ACCOUNT",
					placeholder: "ADMIN_P_HD_ACCOUNT"
				},
				{
					widget: "text",
					lookup: "account",
					path: "payAccount",
					label: "ADMIN_F_HD_PAY_ACCOUNT",
					hint: "ADMIN_H_HD_PAY_ACCOUNT",
					placeholder: "ADMIN_P_HD_ACCOUNT"
				}
			]
		},
		{
			icon: "ranking-star",
			title: "ADMIN_C_HD_SKILL",
			desc: "ADMIN_C_HD_SKILL_DESC",
			fields: [
				num("checks", "CHECKS", 10),
				num("repGain.exotic", "REP_EXOTIC", 100),
				num("repGain.rare", "REP_RARE", 100),
				num("repGain.common", "REP_COMMON", 100),
				num("maxRep", "MAX_REP", 1e5)
			]
		},
		{
			icon: "list",
			title: "ADMIN_C_HD_LEVELS",
			desc: "ADMIN_C_HD_LEVELS_DESC",
			fields: [{
				widget: "list",
				path: "levels",
				label: "ADMIN_F_HD_LEVELS",
				addLabel: "ADMIN_ADD_HD_LEVEL",
				max: 10,
				newRow: NEW_LEVEL,
				rows: [{
					widget: "number",
					path: "rep",
					label: "ADMIN_F_HD_LEVEL_REP",
					min: 0,
					max: 1e5
				}, {
					widget: "number",
					path: "stock",
					label: "ADMIN_F_HD_LEVEL_STOCK",
					min: 1,
					max: 1e3
				}]
			}]
		},
		{
			icon: "tag",
			title: "ADMIN_C_HD_PRICES",
			desc: "ADMIN_C_HD_PRICES_DESC",
			fields: [{
				widget: "list",
				path: "levels",
				label: "ADMIN_F_HD_LEVELS",
				addLabel: "ADMIN_ADD_HD_LEVEL",
				max: 10,
				newRow: NEW_LEVEL,
				rows: [
					priceRow("exoticMin", "EXOTIC_MIN"),
					priceRow("exoticMax", "EXOTIC_MAX"),
					priceRow("rareMin", "RARE_MIN"),
					priceRow("rareMax", "RARE_MAX"),
					priceRow("commonMin", "COMMON_MIN"),
					priceRow("commonMax", "COMMON_MAX")
				]
			}]
		},
		{
			icon: "user",
			title: "ADMIN_C_PED",
			desc: "ADMIN_C_PED_DESC",
			fields: placePedFields()
		}
	]
}, panel = new AdminPanel({
	title: "ADMIN_TITLE",
	icon: "briefcase",
	files: {
		hotdog: HOTDOG_FILE,
		routes: {
			kind: "records",
			sync: "all",
			labelPath: "label",
			newRecord: {
				label: "",
				kind: "random",
				jobs: [],
				gangs: [],
				depot: {
					x: 0,
					y: 0,
					z: 0
				},
				vehicle: "",
				spawn: {
					x: 0,
					y: 0,
					z: 0,
					heading: 0
				},
				pay: 100,
				account: "bank",
				seconds: 5,
				item: "",
				stops: 5,
				gatherMin: 1,
				gatherMax: 3,
				towModels: DEFAULT_TOW_MODELS,
				blip: {
					sprite: 67,
					color: 5,
					scale: .65
				}
			},
			sections: {
				ped: PLACE_PED_SPEC,
				label: {
					type: "text",
					min: 1,
					max: 48
				},
				kind: {
					type: "enum",
					values: [
						"ordered",
						"random",
						"gather",
						"tow"
					]
				},
				...ACCESS_FIELDS,
				depot: { type: "vec3" },
				vehicle: {
					type: "text",
					min: 0,
					max: 32
				},
				spawn: { type: "vec4" },
				pay: {
					type: "number",
					min: 0,
					max: 1e5,
					integer: !0
				},
				account: {
					type: "text",
					lookup: "account",
					min: 2,
					max: 32,
					optional: !0
				},
				seconds: {
					type: "number",
					min: 0,
					max: 120,
					integer: !0
				},
				item: {
					type: "text",
					lookup: "item",
					min: 0,
					max: 48
				},
				stops: {
					type: "number",
					min: 0,
					max: 100,
					integer: !0
				},
				gatherMin: {
					type: "number",
					min: 1,
					max: 100,
					integer: !0,
					optional: !0
				},
				gatherMax: {
					type: "number",
					min: 1,
					max: 100,
					integer: !0,
					optional: !0
				},
				towModels: {
					type: "names",
					max: 40,
					itemMax: 32,
					pattern: "^[a-z0-9_]+$",
					optional: !0
				},
				blip: {
					type: "object",
					optional: !0,
					fields: BLIP_STYLE_FIELDS
				}
			}
		},
		stops: {
			kind: "records",
			sync: "all",
			keyPattern: "^[a-z0-9_]{2,48}$",
			labelPath: "label",
			newRecord: {
				route: "taxi",
				label: "",
				coords: {
					x: 0,
					y: 0,
					z: 0
				}
			},
			sections: {
				route: {
					type: "text",
					min: 2,
					max: 32
				},
				label: {
					type: "text",
					min: 1,
					max: 48
				},
				coords: { type: "vec3" }
			}
		}
	},
	tabs: [
		{
			id: "routes",
			file: "routes",
			icon: "briefcase",
			label: "ADMIN_TAB_ROUTES",
			desc: "ADMIN_TAB_ROUTES_DESC",
			listSub: "kind",
			createLabel: "ADMIN_NEW_ROUTE",
			deleteLabel: "ADMIN_DELETE_ROUTE",
			deleteDesc: "ADMIN_DELETE_ROUTE_DESC",
			cards: [
				{
					icon: "briefcase",
					title: "ADMIN_C_ROUTE",
					desc: "ADMIN_C_ROUTE_DESC",
					fields: [
						{
							widget: "text",
							path: "label",
							suggest: { from: "depot" },
							label: "ADMIN_F_LABEL",
							placeholder: "ADMIN_P_LABEL"
						},
						{
							widget: "select",
							path: "kind",
							label: "ADMIN_F_KIND",
							hint: "ADMIN_H_KIND",
							options: [
								{
									value: "random",
									label: "ADMIN_O_RANDOM"
								},
								{
									value: "ordered",
									label: "ADMIN_O_ORDERED"
								},
								{
									value: "gather",
									label: "ADMIN_O_GATHER"
								},
								{
									value: "tow",
									label: "ADMIN_O_TOW"
								}
							]
						},
						...accessFields(),
						{
							widget: "point",
							path: "depot",
							label: "ADMIN_F_DEPOT",
							hint: "ADMIN_H_DEPOT",
							ground: !0
						},
						{
							widget: "number",
							path: "stops",
							label: "ADMIN_F_STOPS",
							hint: "ADMIN_H_STOPS",
							min: 0,
							max: 100
						},
						{
							widget: "number",
							path: "seconds",
							label: "ADMIN_F_SECONDS",
							hint: "ADMIN_H_SECONDS",
							min: 0,
							max: 120,
							unit: "s"
						},
						{
							widget: "blip",
							path: "blip",
							label: "ADMIN_F_BLIP"
						}
					]
				},
				{
					icon: "car",
					title: "ADMIN_C_VEHICLE",
					desc: "ADMIN_C_VEHICLE_DESC",
					fields: [
						{
							widget: "text",
							path: "vehicle",
							label: "ADMIN_F_VEHICLE",
							hint: "ADMIN_H_VEHICLE",
							placeholder: "ADMIN_P_VEHICLE"
						},
						{
							widget: "point",
							path: "spawn",
							label: "ADMIN_F_SPAWN",
							heading: !0,
							ground: !0
						},
						{
							widget: "number",
							path: "pay",
							label: "ADMIN_F_PAY",
							hint: "ADMIN_H_PAY",
							min: 0,
							max: 1e5,
							unit: "$"
						},
						{
							widget: "text",
							lookup: "account",
							path: "account",
							label: "ADMIN_F_ACCOUNT",
							hint: "ADMIN_H_ACCOUNT"
						},
						{
							widget: "tags",
							path: "towModels",
							label: "ADMIN_F_TOW_MODELS",
							hint: "ADMIN_H_TOW_MODELS",
							placeholder: "ADMIN_P_VEHICLE",
							showIf: {
								path: "kind",
								values: ["tow"]
							}
						}
					]
				},
				{
					icon: "box",
					title: "ADMIN_C_GATHER",
					desc: "ADMIN_C_GATHER_DESC",
					fields: [
						{
							widget: "text",
							lookup: "item",
							path: "item",
							label: "ADMIN_F_ITEM",
							hint: "ADMIN_H_ITEM",
							placeholder: "ADMIN_P_ITEM"
						},
						{
							widget: "number",
							path: "gatherMin",
							label: "ADMIN_F_GATHER_MIN",
							min: 1,
							max: 100
						},
						{
							widget: "number",
							path: "gatherMax",
							label: "ADMIN_F_GATHER_MAX",
							hint: "ADMIN_H_GATHER_MAX",
							min: 1,
							max: 100
						}
					]
				},
				{
					icon: "user",
					title: "ADMIN_C_PED",
					desc: "ADMIN_C_PED_DESC",
					fields: placePedFields()
				}
			]
		},
		{
			id: "stops",
			file: "stops",
			icon: "location-dot",
			label: "ADMIN_TAB_STOPS",
			desc: "ADMIN_TAB_STOPS_DESC",
			listSub: "route",
			createLabel: "ADMIN_NEW_STOP",
			deleteLabel: "ADMIN_DELETE_STOP",
			cards: [{
				icon: "location-dot",
				title: "ADMIN_C_STOP",
				desc: "ADMIN_C_STOP_DESC",
				fields: [
					{
						widget: "text",
						path: "route",
						label: "ADMIN_F_ROUTE",
						hint: "ADMIN_H_ROUTE",
						placeholder: "ADMIN_P_ROUTE"
					},
					{
						widget: "text",
						path: "label",
						suggest: { from: "coords" },
						label: "ADMIN_F_STOP_LABEL",
						placeholder: "ADMIN_P_STOP_LABEL"
					},
					{
						widget: "point",
						path: "coords",
						label: "ADMIN_F_COORDS",
						hint: "ADMIN_H_COORDS",
						ground: !0
					}
				]
			}]
		},
		HOTDOG_TAB
	]
}), HOTDOG_EVENTS = {
	start: "ai-jobs:hotdog:start",
	stop: "ai-jobs:hotdog:stop",
	grab: "ai-jobs:hotdog:grab",
	release: "ai-jobs:hotdog:release",
	prepare: "ai-jobs:hotdog:prepare",
	offer: "ai-jobs:hotdog:offer",
	sell: "ai-jobs:hotdog:sell",
	decline: "ai-jobs:hotdog:decline",
	stands: "ai-jobs:client:hotdogStands",
	shift: "ai-jobs:client:hotdogShift",
	cooking: "ai-jobs:client:hotdogCooking"
}, QB_LEVELS = [
	[
		0,
		15,
		8,
		12,
		6,
		9,
		4,
		6
	],
	[
		50,
		30,
		9,
		13,
		7,
		10,
		5,
		7
	],
	[
		100,
		45,
		10,
		14,
		8,
		11,
		6,
		9
	],
	[
		200,
		60,
		11,
		15,
		9,
		12,
		7,
		9
	]
].map(([rep = 0, stock = 0, a = 0, b = 0, c = 0, d = 0, e = 0, f = 0]) => ({
	rep,
	stock,
	prices: {
		exotic: {
			min: a,
			max: b
		},
		rare: {
			min: c,
			max: d
		},
		common: {
			min: e,
			max: f
		}
	}
}));
function readLevel(v) {
	let range = (q) => {
		let min = int(v[`${q}Min`], 1, 0, 1e4);
		return {
			min,
			max: Math.max(min, int(v[`${q}Max`], min, 0, 1e4))
		};
	};
	return {
		rep: int(v.rep, 0, 0, 1e5),
		stock: int(v.stock, 15, 1, 1e3),
		prices: {
			exotic: range("exotic"),
			rare: range("rare"),
			common: range("common")
		}
	};
}
function readHotdog(raw) {
	let v = record(raw), c = record(v.coords), coords = {
		x: num$1(c.x, 0),
		y: num$1(c.y, 0),
		z: num$1(c.z, 0)
	}, levels = Array.isArray(v.levels) ? v.levels.map((row) => readLevel(record(row))) : [], gain = record(v.repGain);
	return {
		enabled: bool(v.enabled, !0),
		access: readAccess(v),
		coords,
		ped: readPlacePed(v.ped),
		blip: readBlipStyle(v.blip, {
			sprite: 542,
			color: 17,
			scale: .6
		}),
		spawn: vec4(v.spawn, {
			...coords,
			heading: 0
		}),
		model: str(v.model, "prop_hotdogstand_01", 64),
		deposit: int(v.deposit, 250, 0, 1e6),
		depositAccount: str(v.depositAccount, "bank", 32),
		payAccount: str(v.payAccount, "cash", 32),
		checks: int(v.checks, 3, 1, 10),
		repGain: {
			exotic: int(gain.exotic, 3, 0, 100),
			rare: int(gain.rare, 2, 0, 100),
			common: int(gain.common, 1, 0, 100)
		},
		maxRep: int(v.maxRep, 200, 0, 1e5),
		levels: (levels.length ? levels : QB_LEVELS).sort((a, b) => a.rep - b.rep)
	};
}
function levelOf(levels, rep) {
	let level = 0;
	for (let i = 0; i < levels.length; i++) rep >= (levels[i]?.rep ?? 0) && (level = i);
	return level;
}
// resource/server/hotdogStands.ts
const stands = new class {
	nextId = 1;
	stream = new AreaStream({
		event: HOTDOG_EVENTS.stands,
		view: (stand) => stand
	});
	get(id) {
		return this.stream.get(id);
	}
	add(owner, at, heading) {
		let stand = {
			id: this.nextId++,
			x: at.x,
			y: at.y,
			z: at.z,
			heading,
			owner,
			pusher: 0
		};
		return this.stream.set(stand), stand;
	}
	update(id, change) {
		let stand = this.stream.get(id);
		stand && this.stream.set({
			...stand,
			...change
		});
	}
	remove(id) {
		this.stream.delete(id);
	}
	start(source) {
		this.stream.start(source);
	}
	stop(source) {
		this.stream.stop(source);
	}
	follow() {
		if (this.stream.size !== 0) {
			this.stream.followAll();
			for (let stand of this.stream.values()) {
				if (!stand.pusher) continue;
				let p = coordsOf(stand.pusher);
				distance(p, stand) > 8 && this.stream.set({
					...stand,
					x: p.x,
					y: p.y,
					z: p.z
				}, !1);
			}
		}
	}
}();
every(2e3, () => stands.follow(), { name: "hotdogFollow" }), onCharacter({
	loaded: (source) => stands.start(source),
	unloaded: (source) => stands.stop(source)
});
// resource/server/hotdogShifts.ts
const core$2 = resourceExport("ai-core"), hotdogSettings = panel.view("hotdog", readHotdog), shifts$1 = new class {
	map = new PlayerMap({ onDrop: (_source, shift) => stands.remove(shift.stand) });
	get(source) {
		return this.map.get(source);
	}
	start(source, deposit, account) {
		let s = hotdogSettings.value, shift = {
			stand: stands.add(source, s.spawn, s.spawn.heading).id,
			deposit,
			account,
			rep: int(record(core$2.GetMeta(source, "rep")).hotdog, 0, 0, 1e6),
			stock: {
				exotic: 0,
				rare: 0,
				common: 0
			},
			offer: null
		};
		this.map.set(source, shift), this.send(source, shift);
	}
	end(source, refund) {
		let shift = this.map.get(source);
		shift && (this.map.delete(source), stands.remove(shift.stand), refund && shift.deposit > 0 && core$2.AddMoney(source, shift.account, shift.deposit, "hotdog:deposit"), isOnline(source) && this.send(source, null));
	}
	endAll() {
		for (let source of this.map.keys()) this.end(source, !0);
	}
	levelOf(shift) {
		let { levels } = hotdogSettings.value, index = levelOf(levels, shift.rep);
		return {
			index,
			level: levels[index] ?? levels[0]
		};
	}
	addRep(source, shift, gain) {
		let rep = Math.min(hotdogSettings.value.maxRep, shift.rep + gain);
		rep !== shift.rep && (shift.rep = rep, core$2.SetMeta(source, "rep", {
			...record(core$2.GetMeta(source, "rep")),
			hotdog: rep
		}));
	}
	send(source, shift) {
		let view = null;
		if (shift) {
			let { index, level } = this.levelOf(shift);
			view = {
				stand: shift.stand,
				stock: { ...shift.stock },
				max: level?.stock ?? 0,
				level: index + 1,
				rep: shift.rep
			};
		}
		emitNet(HOTDOG_EVENTS.shift, source, view);
	}
	atStand(source, metres) {
		let shift = this.map.get(source), stand = shift ? stands.get(shift.stand) : void 0;
		return !shift || !stand ? "HOTDOG_ERR_NO_STAND" : stand.pusher ? "HOTDOG_ERR_PUSHING" : isNear(source, stand, metres) ? {
			shift,
			stand
		} : "HOTDOG_ERR_FAR";
	}
}();
onCharacter({ unloaded: (source) => shifts$1.end(source, !1) }), onStop(() => shifts$1.endAll());
// resource/server/hotdog.ts
const core$1 = resourceExport("ai-core"), QUALITY_TEXT = {
	exotic: "HOTDOG_Q_EXOTIC",
	rare: "HOTDOG_Q_RARE",
	common: "HOTDOG_Q_COMMON"
};
onClientCallback(HOTDOG_EVENTS.start, (source) => {
	let s = hotdogSettings.value;
	return s.enabled ? shifts$1.get(source) ? fail("HOTDOG_ERR_WORKING") : isNear(source, s.coords, 4) ? online.allows(source, s.access) ? s.deposit > 0 && !core$1.RemoveMoney(source, s.depositAccount, s.deposit, "hotdog:deposit") ? fail("HOTDOG_ERR_MONEY") : (shifts$1.start(source, s.deposit, s.depositAccount), s.deposit > 0 && notify(source, Locale("HOTDOG_DEPOSIT_PAID", s.deposit), "success"), { ok: !0 }) : fail("HOTDOG_ERR_JOB") : fail("HOTDOG_ERR_FAR") : fail("HOTDOG_ERR_OFF");
}, { lock: !0 }), onClientCallback(HOTDOG_EVENTS.stop, (source) => {
	let shift = shifts$1.get(source);
	return shift ? isNear(source, hotdogSettings.value.coords, 4) ? (shifts$1.end(source, !0), shift.deposit > 0 && notify(source, Locale("HOTDOG_DEPOSIT_BACK", shift.deposit), "success"), { ok: !0 }) : fail("HOTDOG_ERR_FAR") : fail("HOTDOG_ERR_NO_STAND");
}, { lock: !0 }), onClientCallback(HOTDOG_EVENTS.grab, (source) => {
	let at = shifts$1.atStand(source, 3);
	return typeof at == "string" ? fail(at) : (at.shift.offer = null, stands.update(at.stand.id, { pusher: source }), { ok: !0 });
}), onClientCallback(HOTDOG_EVENTS.release, { args: ([x, y, z, h]) => {
	let a = readFinite(x), b = readFinite(y), c = readFinite(z), d = readFinite(h);
	return a === null || b === null || c === null || d === null ? null : [
		a,
		b,
		c,
		d
	];
} }, (source, x, y, z, heading) => {
	let shift = shifts$1.get(source), stand = shift ? stands.get(shift.stand) : void 0;
	if (!shift || !stand || stand.pusher !== source) return fail("HOTDOG_ERR_NO_STAND");
	let ped = coordsOf(source), at = distance(ped, {
		x,
		y,
		z
	}) <= 4 ? {
		x,
		y,
		z
	} : ped;
	return stands.update(stand.id, {
		...at,
		heading,
		pusher: 0
	}), { ok: !0 };
});
async function cook(source) {
	let misses = 0;
	for (let i = 0; i < hotdogSettings.value.checks; i++) await minigameFor(source, {
		game: "skillCheck",
		difficulty: "easy",
		rounds: 1,
		keys: [
			"w",
			"a",
			"s",
			"d"
		],
		minMs: 400
	}) !== "won" && misses++;
	return misses;
}
onClientCallback(HOTDOG_EVENTS.prepare, async (source) => {
	let at = shifts$1.atStand(source, 3);
	if (typeof at == "string") return fail(at);
	let { shift } = at;
	emitNet(HOTDOG_EVENTS.cooking, source, !0);
	let misses = await cook(source);
	if (!isOnline(source) || (emitNet(HOTDOG_EVENTS.cooking, source, !1), shifts$1.get(source) !== shift)) return { ok: !0 };
	let quality = misses === 0 ? "exotic" : misses === 1 ? "rare" : "common", label = Locale(QUALITY_TEXT[quality]), { index, level } = shifts$1.levelOf(shift), max = level?.stock ?? 0;
	if (shift.stock[quality] + 1 > max) return notify(source, Locale("HOTDOG_NO_MORE", label), "error"), { ok: !0 };
	let made = index > 0 && rollChance(50) ? randomInt(1, index + 1) : 1;
	return shift.stock[quality] = Math.min(max, shift.stock[quality] + made), shifts$1.addRep(source, shift, hotdogSettings.value.repGain[quality]), shifts$1.send(source, shift), notify(source, made > 1 ? Locale("HOTDOG_MADE_LUCKY", made, label) : Locale("HOTDOG_MADE", label), "success"), { ok: !0 };
}, { lock: !0 });
// resource/server/index.ts
const core = resourceExport("ai-core"), routes = panel.records("routes", readRoute), stops = new class {
	byRoute = new Map();
	sorted = new Map();
	add(stop) {
		let map = this.byRoute.get(stop.route);
		return map || this.byRoute.set(stop.route, map = new Map()), map.set(stop.id, stop), this.sorted.delete(stop.route), () => {
			map.delete(stop.id), map.size === 0 && this.byRoute.delete(stop.route), this.sorted.delete(stop.route);
		};
	}
	of(route) {
		let list = this.sorted.get(route);
		return list || (list = [...this.byRoute.get(route)?.values() ?? []].sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: !0 })), this.sorted.set(route, list)), list;
	}
}();
new RecordObjects(panel, "stops", readStop, (_id, stop) => stops.add(stop)), aiLogChannels({
	work: { active: !1 },
	hotdog: { active: !1 }
});
const readTextId = oneArg((v) => readText(v, 64));
async function spawnTowed(route, stop) {
	return await spawnVehicle({
		model: pickRandom(route.towModels) ?? "asea",
		type: "automobile",
		coords: {
			x: stop.x,
			y: stop.y,
			z: stop.z,
			heading: Math.random() * 360
		},
		locked: !0
	}) ?? 0;
}
function removeEntities(work) {
	for (let entity of [work.vehicle, work.towed]) entity && DoesEntityExist(entity) && DeleteEntity(entity);
}
function assign(work, stop, from) {
	work.stop = stop, work.since = GetGameTimer(), work.minMs = distance(from, stop) / 60 * 1e3;
}
function stopRefusal(source, work, stopId) {
	if (shifts.get(source) !== work || work.stop.id !== stopId) return fail("JOBS_ERR_GONE");
	let p = coordsOf(source);
	return distance(p, work.stop) > 12 ? fail("JOBS_ERR_FAR") : work.route.kind !== "gather" && work.vehicle && (!DoesEntityExist(work.vehicle) || distance(entityCoords(work.vehicle), p) > 15) ? fail("JOBS_ERR_VEHICLE_FAR") : null;
}
const depotStop = (route) => ({
	id: "depot",
	route: route.id,
	label: route.label,
	...route.depot
}), shifts = new PlayerMap({ onDrop: (_source, work) => removeEntities(work) });
function nextStop(route, work) {
	let list = stops.of(route.id);
	if (list.length === 0) return null;
	if (route.kind === "ordered") {
		let index = work ? (work.index + 1) % list.length : 0, stop = list[index];
		return stop ? {
			stop,
			index
		} : null;
	}
	let choices = list.length > 1 && work ? list.filter((s) => s.id !== work.stop.id) : list, stop = pickRandom(choices);
	return stop ? {
		stop,
		index: list.indexOf(stop)
	} : null;
}
function send(source, work) {
	let shift = work ? {
		route: work.route.id,
		stop: work.stop,
		done: work.done,
		total: work.route.stops,
		netId: work.vehicle ? NetworkGetNetworkIdFromEntity(work.vehicle) : null
	} : null;
	emitNet(EVENTS.shift, source, shift);
}
function end(source) {
	let work = shifts.get(source);
	shifts.delete(source), work && removeEntities(work), send(source, null);
}
onClientCallback(EVENTS.start, {
	args: readTextId,
	lock: !0
}, async (source, id) => {
	let route = routes.get(id);
	if (!route) return fail("JOBS_ERR_GONE");
	if (shifts.has(source)) return fail("JOBS_ERR_WORKING");
	if (!isNear(source, route.depot, 4)) return fail("JOBS_ERR_FAR");
	if (!online.allows(source, route.access)) return fail("JOBS_ERR_JOB");
	let first = nextStop(route, null);
	if (!first) return fail("JOBS_ERR_NO_STOPS");
	let vehicle = null;
	if (route.vehicle && route.kind !== "gather" && (vehicle = await spawnVehicle({
		model: route.vehicle,
		asker: source,
		coords: route.spawn,
		plate: `WORK${source}`,
		keysTo: source,
		purpose: "job"
	}), vehicle === null)) return fail("JOBS_ERR_VEHICLE");
	let towed = route.kind === "tow" ? await spawnTowed(route, first.stop) : 0, work = {
		route,
		stop: first.stop,
		done: 0,
		vehicle,
		index: first.index,
		since: 0,
		minMs: 0,
		towed,
		loaded: !1
	};
	return isOnline(source) ? (assign(work, first.stop, route.depot), shifts.set(source, work), send(source, work), { ok: !0 }) : (removeEntities(work), fail("JOBS_ERR_GONE"));
}), onClientCallback(EVENTS.stop, (source) => (end(source), { ok: !0 })), onClientCallback(EVENTS.arrive, {
	args: ([id, underwater]) => {
		let stopId = readText(id, 64);
		return stopId === null ? null : [stopId, underwater === !0];
	},
	lock: !0
}, async (source, stopId, underwater) => {
	let work = shifts.get(source);
	if (!work) return fail("JOBS_ERR_GONE");
	let before = stopRefusal(source, work, stopId);
	if (before) return before;
	if (GetGameTimer() - work.since < work.minMs) return fail("JOBS_ERR_FAST");
	let gather = work.route.kind === "gather";
	if (!await progressFor(source, {
		label: Locale("JOBS_WORKING"),
		duration: work.route.seconds * 1e3,
		anim: gather && !underwater ? {
			dict: "amb@prop_human_bum_bin@base",
			clip: "base"
		} : void 0,
		allowVehicle: !gather
	})) return { ok: !0 };
	let after = stopRefusal(source, work, stopId);
	if (after) return after;
	if (work.route.kind === "tow" && !work.loaded) {
		if (!work.towed || !DoesEntityExist(work.towed) || !work.vehicle) return fail("JOBS_ERR_GONE");
		let owner = NetworkGetEntityOwner(work.towed);
		return emitNet(EVENTS.attach, owner > 0 ? owner : source, NetworkGetNetworkIdFromEntity(work.towed), NetworkGetNetworkIdFromEntity(work.vehicle)), work.loaded = !0, assign(work, depotStop(work.route), work.stop), send(source, work), { ok: !0 };
	}
	if (work.route.kind === "tow" && work.towed) {
		if (!DoesEntityExist(work.towed) || !work.vehicle || distance(entityCoords(work.towed), entityCoords(work.vehicle)) > 15) return fail("JOBS_ERR_TOW_LOST");
		DeleteEntity(work.towed), work.towed = 0, work.loaded = !1;
	}
	if (work.route.kind === "gather" && work.route.item) {
		let { gatherMin, gatherMax } = work.route, count = randomInt(gatherMin, gatherMax);
		if (!inventory.addItem(source, work.route.item, count)) return fail("JOBS_ERR_SPACE");
	} else work.route.pay > 0 && (core.AddMoney(source, work.route.account, work.route.pay, `work:${work.route.id}`), notify(source, Locale("JOBS_PAID", work.route.pay), "success", 2500));
	if (work.done++, aiLog("work", `stop ${stopId}`, {
		source,
		metadata: { route: work.route.id }
	}), work.route.stops > 0 && work.done >= work.route.stops) return notify(source, Locale("JOBS_SHIFT_DONE"), "success"), end(source), { ok: !0 };
	let next = nextStop(work.route, work);
	if (!next) return end(source), { ok: !0 };
	let from = work.stop;
	if (work.index = next.index, work.route.kind === "tow") {
		let towed = await spawnTowed(work.route, next.stop);
		if (shifts.get(source) !== work) return towed && DoesEntityExist(towed) && DeleteEntity(towed), { ok: !0 };
		work.towed = towed;
	}
	return assign(work, next.stop, from), send(source, work), { ok: !0 };
}), onStop(() => {
	for (let work of shifts.values()) removeEntities(work);
});
