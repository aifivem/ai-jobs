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
function waitFor(check, timeoutMs = 1e4) {
	return new Promise((resolve, reject) => {
		let started = Date.now(), poll = () => {
			let value = check();
			if (value !== void 0) return resolve(value);
			if (timeoutMs !== !1 && Date.now() - started > timeoutMs) return reject(Error(`waitFor timed out after ${timeoutMs} ms`));
			setTimeout(poll, 0);
		};
		poll();
	});
}
// ../../../packages/lib/src/shared/read.ts
function num(value, fallback, min = -Infinity, max = Infinity) {
	return typeof value == "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function int(value, fallback, min = -Infinity, max = Infinity) {
	return Math.round(num(value, fallback, min, max));
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
		x: num(v.x, fallback.x),
		y: num(v.y, fallback.y),
		z: num(v.z, fallback.z),
		heading: num(v.heading, fallback.heading)
	};
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
// ../../../packages/lib/src/shared/index.ts
function isRecord(value) {
	return typeof value == "object" && !!value && !Array.isArray(value);
}
function logSafe(text, max) {
	return text.replace(/\r?\n/g, " | ").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\^\d/g, "").slice(0, max);
}
function formatText(template, args) {
	return template.replace(/\{(\d+)\}/g, (match, index) => {
		let value = args[Number(index)];
		return value === void 0 ? match : String(value);
	});
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
	playerUnloadedEvent: "ai-core:playerUnloaded",
	moneyChangedEvent: "ai-core:moneyChanged",
	jobsChangedEvent: "ai-core:jobsChanged",
	dutyChangedEvent: "ai-core:dutyChanged",
	gangsChangedEvent: "ai-core:gangsChanged",
	activeGangChangedEvent: "ai-core:activeGangChanged",
	characterScreenEvent: "ai-core:characterScreen",
	inventoryChangedEvent: "ai-core:inventoryChanged",
	itemUsedEvent: "ai-core:itemUsed",
	playerDiedEvent: "ai-core:playerDied",
	clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
	clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
	clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
	clientCharacterLookEvent: "ai-core:client:characterLook",
	clientPromptPressedEvent: "ai-core:client:promptPressed",
	clientCacheEvent: "ai-core:client:cache",
	clientHudVisibleEvent: "ai-core:client:hudVisible",
	vehicleTypeCallback: "ai-core:vehicleType",
	interactionStateKey: "ai:interaction",
	charactersCallback: "ai-core:characters",
	createCharacterCallback: "ai-core:createCharacter",
	deleteCharacterCallback: "ai-core:deleteCharacter",
	selectCharacterCallback: "ai-core:selectCharacter",
	clientNotifyEvent: "ai-core:client:notify",
	spawnEvent: "ai-core:client:spawn",
	openCharactersEvent: "ai-core:client:openCharacters"
}, ADMIN = {
	ace: "ai.admin",
	openCallback: "ai-core:admin:open",
	applyCallback: "ai-core:admin:apply",
	closeEvent: "ai-core:admin:close",
	showEvent: "ai-core:admin:show",
	deltaEvent: "ai-core:admin:delta",
	worldEvent: (resource) => `${resource}:admin:world`,
	worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
}, VEHICLE_BAGS = {
	owned: "ai:owned",
	id: "ai:vid",
	props: "ai:props",
	fuel: "fuel"
};
// ../../../packages/lib/src/fivem/exports.ts
function registerExport(name, handler) {
	globalThis.exports(name, handler);
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
resourceExport(CORE.resource);
const log$4 = createLogger(GetCurrentResourceName()), gates = new Set();
on("playerDropped", () => {
	let source = Number(globalThis.source);
	for (let gate of gates) gate.release(source);
});
var ClientGate = class {
	name;
	options;
	limit;
	lock;
	constructor(name, options, defaultRate) {
		this.name = name, this.options = options, this.limit = new RateLimit(options.rate?.count ?? defaultRate, options.rate?.windowMs ?? 1e3), this.lock = options.lock ? new SourceLock() : null, gates.add(this);
	}
	check(source, raw) {
		if (!(source > 0) || !GetPlayerName(String(source)) || !this.limit.take(source)) return null;
		for (let guard of this.options.guards ?? []) {
			let verdict = guard(source);
			if (verdict !== !0) return typeof verdict == "string" && this.refuse(source, verdict), null;
		}
		if (!this.options.args) return [];
		let args = this.options.args(raw);
		return args === null && this.refuse(source, `invalid arguments ${logSafe(JSON.stringify(raw) ?? "", 200)}`), args;
	}
	run(source, busy, task) {
		return this.lock ? this.lock.run(source, busy, async () => task()) : Promise.resolve(task());
	}
	release(source) {
		this.limit.release(source), this.lock?.release(source);
	}
	refuse(source, reason) {
		log$4.warn(`${this.name} refused for ${GetPlayerName(String(source))} (${source}): ${reason}`);
	}
};
// ../../../packages/lib/src/server/callback.ts
const log$3 = createLogger(GetCurrentResourceName()), resource$1 = GetCurrentResourceName(), REFUSED = Symbol("refused");
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
			log$3.error(`callback ${name} failed for ${source}`, error), emitNet(responseEvent(caller), source, id, !1, null);
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
const clone = (value) => value === void 0 ? value : JSON.parse(JSON.stringify(value)), core$7 = resourceExport(CORE.resource), ERR = {
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
			list = core$7.GetLookupValues(source);
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
const core$6 = resourceExport(CORE.resource), DEFAULT_KEY = "^[a-z0-9_]{2,32}$";
function imported(spec, value) {
	let base = clone(spec.newRecord ?? {}), out = {};
	for (let name of Object.keys(spec.sections)) {
		let v = name in value ? value[name] : base[name];
		v !== void 0 && (out[name] = clone(v));
	}
	return out;
}
var AdminPanel = class {
	schema;
	data = new Map();
	dataFiles = new Map();
	handlers = new Map();
	rules = new Map();
	worldChanges = new Map();
	resource = GetCurrentResourceName();
	log = createLogger(this.resource);
	constructor(schema) {
		this.schema = schema;
		for (let [name, spec] of Object.entries(schema.files)) this.load(name, spec);
		registerExport("AdminPanelSnapshot", () => this.snapshot()), registerExport("AdminPanelApply", (admin, patch) => this.apply(admin, patch)), onClientCallback(ADMIN.worldChangesCallback(this.resource), () => Object.fromEntries(this.worldChanges)), setImmediate(() => core$6.RegisterAdminPanel(this.resource));
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
	snapshot() {
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data: clone(Object.fromEntries(this.data))
		};
	}
	apply(admin, raw) {
		let patch = toPatch(raw), spec = patch ? this.schema.files[patch.file] : void 0;
		if (!patch || !spec || spec.memory) return {
			ok: !1,
			error: ERR.type
		};
		let error = this.check(patch, spec);
		return error ? (this.log.warn(`admin ${admin} edit refused (${error}): ${JSON.stringify(patch).slice(0, 300)}`), {
			ok: !1,
			error
		}) : (this.store(patch, spec), { ok: !0 });
	}
	commit(file, key, value) {
		let data = this.data.get(file);
		data && (key === void 0 ? isRecord(value) && this.data.set(file, clone(value)) : value === null ? delete data[key] : data[key] = clone(value), this.changed(file, key));
	}
	check(patch, spec) {
		let data = this.get(patch.file);
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
				}
				let ruled = this.rules.get(patch.file)?.(key, record);
				if (ruled) return ruled;
			}
			return null;
		}
		let section = spec.sections[patch.section];
		if (!section || spec.kind === "records" && (!patch.key || !(patch.key in data))) return ERR.type;
		let refusal = validate(section, patch.value, patch.section);
		if (refusal) return refusal.error;
		let current = spec.kind === "records" ? data[patch.key ?? ""] : data, next = {
			...isRecord(current) ? current : {},
			[patch.section]: patch.value
		};
		return this.rules.get(patch.file)?.(patch.key, next) ?? null;
	}
	store(patch, spec) {
		let data = this.data.get(patch.file) ?? {};
		if (patch.action === "create") {
			let record = clone(spec.newRecord ?? {});
			spec.labelPath && (record[spec.labelPath] = patch.label), data[patch.key] = record;
		} else if (patch.action === "delete") delete data[patch.key];
		else if (patch.action === "import") {
			for (let [key, value] of Object.entries(patch.records)) data[key] = imported(spec, value);
			this.data.set(patch.file, data);
			for (let key of Object.keys(patch.records)) this.changed(patch.file, key);
			return;
		} else {
			let target = spec.kind === "records" ? data[patch.key ?? ""] : data;
			if (!isRecord(target)) return;
			patch.value === void 0 || patch.value === null ? delete target[patch.section] : target[patch.section] = clone(patch.value);
		}
		this.data.set(patch.file, data), this.changed(patch.file, spec.kind === "records" ? patch.key : void 0);
	}
	changed(file, key) {
		let spec = this.schema.files[file], data = this.get(file), value = key === void 0 ? data : data[key] ?? null;
		this.dataFiles.get(file)?.write(data);
		for (let handler of this.handlers.get(file) ?? []) handler(key, value);
		if (core$6.AdminPanelChanged({
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
// ../../../packages/lib/src/server/log.ts
function aiLog(channel, message, options) {
	optionalExport("ai-core")?.Log(channel, message, options);
}
function aiLogChannels(channels) {
	optionalExport("ai-core")?.LogChannels(channels);
}
// ../../../packages/lib/src/server/notify.ts
function notify(source, text, kind = "info", duration) {
	let notification = {
		text,
		kind,
		duration
	};
	emitNet(CORE.clientNotifyEvent, source, notification);
}
// ../../../packages/lib/src/server/inventory.ts
const core$5 = resourceExport(CORE.resource), inventory = {
	addItem: (inv, item, count = 1, metadata, slot) => core$5.AddItem(inv, item, count, metadata, slot),
	removeItem: (inv, item, count = 1, metadata, slot) => core$5.RemoveItem(inv, item, count, metadata, slot),
	getItemCount: (inv, item, metadata) => core$5.GetItemCount(inv, item, metadata),
	hasItem: (inv, item, count = 1) => core$5.HasItem(inv, item, count),
	canCarryItem: (inv, item, count = 1, metadata) => core$5.CanCarryItem(inv, item, count, metadata),
	getItems: (inv) => core$5.GetItems(inv),
	clearInventory: (inv) => core$5.ClearInventory(inv),
	registerStash: (name, label, slots, maxWeight, jobs = []) => core$5.RegisterStash(name, label, slots, maxWeight, jobs),
	openInventory: (source, inv) => core$5.OpenInventory(source, inv),
	registerUsableItem: (name, handler) => core$5.RegisterUsableItem(name, handler),
	getItemDefinition: (name) => core$5.GetItemDefinition(name)
}, core$4 = resourceExport(CORE.resource);
var OnlinePlayers = class {
	players = new Map();
	onDuty = new Map();
	started = !1;
	start() {
		if (this.started) return;
		this.started = !0;
		let load = (source, character) => {
			this.put(source, character, (core$4.GetJobs(source) ?? []).map((m) => m.job), (core$4.GetGangs(source) ?? []).map((m) => m.gang)), this.setDuty(source, core$4.GetDutyJob(source));
		};
		on(CORE.playerLoadedEvent, load), on(CORE.playerUnloadedEvent, (source) => this.drop(source)), on(CORE.jobsChangedEvent, (source, jobs) => {
			let player = this.players.get(source);
			player && (player.jobs = jobs.map((m) => m.job));
		}), on(CORE.gangsChangedEvent, (source, gangs) => {
			let player = this.players.get(source);
			player && (player.gangs = gangs.map((m) => m.gang));
		}), on(CORE.dutyChangedEvent, (source, job) => this.setDuty(source, job));
		for (let source of core$4.GetLoadedSources()) {
			let character = core$4.GetCharacter(source);
			character && load(source, character);
		}
	}
	put(source, character, jobs, gangs) {
		this.drop(source), this.players.set(source, {
			character,
			jobs,
			gangs,
			duty: null
		});
	}
	drop(source) {
		this.setDuty(source, null), this.players.delete(source);
	}
	setDuty(source, job) {
		let player = this.players.get(source);
		if (!player || (player.duty && this.onDuty.get(player.duty)?.delete(source), player.duty = job, !job)) return;
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
	jobs(source) {
		return this.start(), this.players.get(source)?.jobs ?? [];
	}
	gangs(source) {
		return this.start(), this.players.get(source)?.gangs ?? [];
	}
	dutyJob(source) {
		return this.start(), this.players.get(source)?.duty ?? null;
	}
	onDutyFor(job) {
		return this.start(), this.onDuty.get(job) ?? EMPTY;
	}
};
const EMPTY = new Set();
new OnlinePlayers();
// ../../../packages/lib/src/server/vehicleKeys.ts
const core$3 = resourceExport(CORE.resource), vehicleKeys = {
	give: (source, vehicle, purpose = "temporary") => core$3.GiveVehicleKeys(source, vehicle, purpose),
	remove: (source, vehicle) => core$3.RemoveVehicleKeys(source, vehicle),
	has: (source, vehicle) => core$3.HasVehicleKeys(source, vehicle)
}, TYPES = new Set([
	"automobile",
	"bike",
	"boat",
	"heli",
	"plane",
	"submarine",
	"trailer",
	"train"
]), types = new Map();
async function vehicleType(model, asker) {
	let known = types.get(model);
	if (known !== void 0) return known;
	let answer = await triggerClientCallback(CORE.vehicleTypeCallback, asker, [model]).catch(() => null);
	return typeof answer != "string" || !TYPES.has(answer) ? null : (types.set(model, answer), answer);
}
async function spawnVehicle(options) {
	let type = options.asker === void 0 ? options.type ?? "automobile" : await vehicleType(options.model, options.asker);
	if (!type) return null;
	let { x, y, z, heading } = options.coords, vehicle = CreateVehicleServerSetter(GetHashKey(options.model), type, x, y, z, heading);
	if (!await waitFor(() => DoesEntityExist(vehicle) || void 0, 5e3).catch(() => !1)) return null;
	options.persistent !== !1 && SetEntityOrphanMode(vehicle, 2), options.plate && SetVehicleNumberPlateText(vehicle, options.plate.slice(0, 8));
	let state = Entity(vehicle).state;
	options.fuel !== void 0 && state.set(VEHICLE_BAGS.fuel, options.fuel, !0);
	for (let [key, value] of Object.entries(options.bags ?? {})) state.set(key, value, !0);
	return options.driver !== void 0 && SetPedIntoVehicle(GetPlayerPed(String(options.driver)), vehicle, -1), options.keysTo !== void 0 && vehicleKeys.give(options.keysTo, vehicle, options.purpose ?? "temporary"), vehicle;
}
resourceExport(CORE.resource);
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
}(), createLogger(GetCurrentResourceName()), createLogger("aicore-lib"), IsDuplicityVersion(), resourceExport(CORE.resource);
// resource/common/locale.ts
const Locale = createLocale(), ResourceName = GetCurrentResourceName();
IsDuplicityVersion();
// resource/common/routes.ts
const EVENTS = {
	start: "ai-jobs:start",
	stop: "ai-jobs:stop",
	arrive: "ai-jobs:arrive",
	shift: "ai-jobs:client:shift",
	attach: "ai-jobs:client:attach"
}, KINDS = [
	"ordered",
	"random",
	"gather",
	"tow"
];
function readRoutes(raw) {
	let out = new Map();
	for (let [id, value] of Object.entries(record(raw))) {
		let v = record(value), d = record(v.depot);
		out.set(id, {
			ped: readPlacePed(v.ped),
			id,
			label: str(v.label, id, 48),
			kind: KINDS.includes(v.kind) ? v.kind : "random",
			job: str(v.job, "", 32),
			depot: {
				x: num(d.x, 0),
				y: num(d.y, 0),
				z: num(d.z, 0)
			},
			vehicle: str(v.vehicle, "", 32),
			spawn: vec4(v.spawn, {
				x: num(d.x, 0),
				y: num(d.y, 0),
				z: num(d.z, 0),
				heading: 0
			}),
			pay: int(v.pay, 0, 0, 1e5),
			seconds: int(v.seconds, 5, 0, 120),
			item: str(v.item, "", 48),
			stops: int(v.stops, 0, 0, 100)
		});
	}
	return out;
}
function readStops(raw) {
	return Object.entries(record(raw)).map(([id, value]) => {
		let v = record(value), c = record(v.coords);
		return {
			id,
			route: str(v.route, "", 32),
			label: str(v.label, id, 48),
			x: num(c.x, 0),
			y: num(c.y, 0),
			z: num(c.z, 0)
		};
	}).filter((s) => s.route !== "").sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: !0 }));
}
// resource/server/schema.ts
const jobsSchema = {
	title: "ADMIN_TITLE",
	icon: "briefcase",
	files: {
		routes: {
			kind: "records",
			sync: "all",
			labelPath: "label",
			newRecord: {
				label: "",
				kind: "random",
				job: "",
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
				seconds: 5,
				item: "",
				stops: 5
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
				job: {
					type: "text",
					lookup: "job",
					min: 0,
					max: 32
				},
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
	tabs: [{
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
					{
						widget: "text",
						lookup: "job",
						path: "job",
						label: "ADMIN_F_JOB",
						hint: "ADMIN_H_JOB",
						placeholder: "ADMIN_P_JOB"
					},
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
					}
				]
			},
			{
				icon: "box",
				title: "ADMIN_C_GATHER",
				desc: "ADMIN_C_GATHER_DESC",
				fields: [{
					widget: "text",
					lookup: "item",
					path: "item",
					label: "ADMIN_F_ITEM",
					hint: "ADMIN_H_ITEM",
					placeholder: "ADMIN_P_ITEM"
				}]
			},
			{
				icon: "user",
				title: "ADMIN_C_PED",
				desc: "ADMIN_C_PED_DESC",
				fields: placePedFields()
			}
		]
	}, {
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
	}]
}, core = resourceExport("ai-core"), panel = new AdminPanel(jobsSchema), content = {
	routes: readRoutes(panel.get("routes")),
	stops: readStops(panel.get("stops"))
};
panel.onChange("routes", () => content.routes = readRoutes(panel.get("routes"))), panel.onChange("stops", () => content.stops = readStops(panel.get("stops"))), aiLogChannels({ work: { active: !1 } });
const fail = (error) => ({
	ok: !1,
	error
}), pos = (source) => {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
	return {
		x,
		y,
		z
	};
}, TOW_MODELS = [
	"asea",
	"premier",
	"emperor",
	"blista",
	"ingot",
	"stanier",
	"washington",
	"oracle"
];
async function spawnTowed(stop) {
	let car = await spawnVehicle({
		model: TOW_MODELS[Math.floor(Math.random() * TOW_MODELS.length)] ?? "asea",
		type: "automobile",
		coords: {
			x: stop.x,
			y: stop.y,
			z: stop.z,
			heading: Math.random() * 360
		}
	});
	return car === null ? 0 : (SetVehicleDoorsLocked(car, 2), car);
}
const depotStop = (route) => ({
	id: "depot",
	route: route.id,
	label: route.label,
	...route.depot
}), shifts = new Map();
function nextStop(route, work) {
	let list = content.stops.filter((s) => s.route === route.id);
	if (list.length === 0) return null;
	if (route.kind === "ordered") {
		let index = work ? (work.index + 1) % list.length : 0, stop = list[index];
		return stop ? {
			stop,
			index
		} : null;
	}
	let choices = list.length > 1 && work ? list.filter((s) => s.id !== work.stop.id) : list, stop = choices[Math.floor(Math.random() * choices.length)];
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
	shifts.delete(source), work?.vehicle && DoesEntityExist(work.vehicle) && DeleteEntity(work.vehicle), work?.towed && DoesEntityExist(work.towed) && DeleteEntity(work.towed), send(source, null);
}
onClientCallback(EVENTS.start, {
	args: ([id]) => typeof id == "string" ? [id] : null,
	lock: !0
}, async (source, id) => {
	let route = content.routes.get(id);
	if (!route) return fail("JOBS_ERR_GONE");
	if (shifts.has(source)) return fail("JOBS_ERR_WORKING");
	let p = pos(source);
	if (Math.hypot(p.x - route.depot.x, p.y - route.depot.y, p.z - route.depot.z) > 4) return fail("JOBS_ERR_FAR");
	if (route.job && !(core.GetJobs(source) ?? []).some((m) => m.job === route.job)) return fail("JOBS_ERR_JOB");
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
	let towed = route.kind === "tow" ? await spawnTowed(first.stop) : 0;
	return shifts.set(source, {
		route,
		stop: first.stop,
		done: 0,
		vehicle,
		index: first.index,
		since: Date.now(),
		towed,
		loaded: !1
	}), send(source, shifts.get(source) ?? null), { ok: !0 };
}), onClientCallback(EVENTS.stop, (source) => (end(source), { ok: !0 })), onClientCallback(EVENTS.arrive, {
	args: ([stopId]) => typeof stopId == "string" ? [stopId] : null,
	lock: !0
}, async (source, stopId) => {
	let work = shifts.get(source);
	if (!work || work.stop.id !== stopId) return fail("JOBS_ERR_GONE");
	let p = pos(source);
	if (Math.hypot(p.x - work.stop.x, p.y - work.stop.y, p.z - work.stop.z) > 12) return fail("JOBS_ERR_FAR");
	if (Date.now() - work.since < work.route.seconds * 800) return fail("JOBS_ERR_FAST");
	if (work.route.kind !== "gather" && work.vehicle) {
		let [vx = 0, vy = 0, vz = 0] = GetEntityCoords(work.vehicle);
		if (!DoesEntityExist(work.vehicle) || Math.hypot(vx - p.x, vy - p.y, vz - p.z) > 15) return fail("JOBS_ERR_VEHICLE_FAR");
	}
	if (work.route.kind === "tow" && !work.loaded) {
		if (!work.towed || !DoesEntityExist(work.towed) || !work.vehicle) return fail("JOBS_ERR_GONE");
		let owner = NetworkGetEntityOwner(work.towed);
		return emitNet(EVENTS.attach, owner > 0 ? owner : source, NetworkGetNetworkIdFromEntity(work.towed), NetworkGetNetworkIdFromEntity(work.vehicle)), work.loaded = !0, work.stop = depotStop(work.route), work.since = Date.now(), send(source, work), { ok: !0 };
	}
	if (work.route.kind === "tow" && work.towed && (DoesEntityExist(work.towed) && DeleteEntity(work.towed), work.towed = 0, work.loaded = !1), work.route.kind === "gather" && work.route.item) {
		let count = 1 + Math.floor(Math.random() * 3);
		if (!inventory.addItem(source, work.route.item, count)) return fail("JOBS_ERR_SPACE");
	} else work.route.pay > 0 && (core.AddMoney(source, "bank", work.route.pay, `work:${work.route.id}`), notify(source, Locale("JOBS_PAID", work.route.pay), "success", 2500));
	if (work.done++, aiLog("work", `stop ${stopId}`, {
		source,
		metadata: { route: work.route.id }
	}), work.route.stops > 0 && work.done >= work.route.stops) return notify(source, Locale("JOBS_SHIFT_DONE"), "success"), end(source), { ok: !0 };
	let next = nextStop(work.route, work);
	return next ? (work.stop = next.stop, work.index = next.index, work.since = Date.now(), work.route.kind === "tow" && (work.towed = await spawnTowed(next.stop)), send(source, work), { ok: !0 }) : (end(source), { ok: !0 });
}), on("playerDropped", () => end(Number(globalThis.source))), on("onResourceStop", (resource) => {
	if (resource === ResourceName) for (let work of shifts.values()) for (let entity of [work.vehicle, work.towed]) entity && DoesEntityExist(entity) && DeleteEntity(entity);
});
