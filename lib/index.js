import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
//#region lib/types/index.js
/**
* we-sync · node half
* Wallpaper Engine ↔ DSH 壁纸同步（纯显示）：轮询 WE 的 config.json，
* 通过 HTTP 路由提供当前壁纸状态与预览图。多显示器：跟踪所有条目，
* 默认跟随"最近变化"的一台；客户端可用 ?monitor= 参数锁定某台。
*
* 无敏感信息。安装目录运行时自动检测（注册表 → 常见 Steam 路径），
* 检测不到时在下方 CONFIG.wallpaperEngineDir 手动指定。
*/
const inject = ["webServer"];
const CONFIG = {
	/** Wallpaper Engine 安装目录；留空 = 自动检测（注册表 HKCU\Software\WallpaperEngine\installPath → 常见 Steam 路径） */
	wallpaperEngineDir: "",
	/** 工作坊内容目录；留空自动推导为 <Steam库>/steamapps/workshop/content/431960 */
	workshopContentDir: "",
	/** 轮询间隔（毫秒） */
	pollIntervalMs: 2e3,
	/** 预览图大小上限（字节） */
	previewMaxBytes: 6291456
};
function apply(ctx) {
	const webServer = ctx.get("webServer");
	if (webServer === void 0) return;
	const state = {
		version: 0,
		snapshot: null,
		latestMonitor: "",
		monitors: [],
		previews: {},
		lastError: "",
		weDir: ""
	};
	const disposers = [];
	ctx.effect(() => () => {
		for (const d of disposers) d();
	});
	function normalize(path) {
		return path.replace(/\\/g, "/");
	}
	function detectWeDir() {
		if (CONFIG.wallpaperEngineDir.trim() !== "") return normalize(CONFIG.wallpaperEngineDir.trim());
		try {
			const out = execFileSync("reg", [
				"query",
				"HKCU\\Software\\WallpaperEngine",
				"/v",
				"installPath"
			], {
				encoding: "utf8",
				windowsHide: true,
				timeout: 5e3
			});
			const match = /REG_SZ\s+(.+)/.exec(out);
			if (match !== null) {
				const installPath = match[1];
				if (installPath !== void 0) return normalize(installPath.trim()).replace(/\/wallpaper(64|32)\.exe$/i, "");
			}
		} catch {}
		for (const dir of [
			"C:/Program Files (x86)/Steam/steamapps/common/wallpaper_engine",
			"D:/Program Files (x86)/Steam/steamapps/common/wallpaper_engine",
			"C:/Steam/steamapps/common/wallpaper_engine",
			"D:/Steam/steamapps/common/wallpaper_engine"
		]) if (existsSync(dir + "/wallpaper64.exe")) return dir;
		return null;
	}
	function resolveWorkshopDir(weDir) {
		if (CONFIG.workshopContentDir.trim() !== "") return normalize(CONFIG.workshopContentDir.trim());
		const idx = weDir.indexOf("/steamapps/common/");
		if (idx >= 0) return weDir.slice(0, idx) + "/steamapps/workshop/content/431960";
		return weDir.replace(/\/common\/[^/]+$/, "") + "/workshop/content/431960";
	}
	function readText(path) {
		return readFileSync(path, "utf8");
	}
	function readBytes(path) {
		const buf = readFileSync(path);
		if (buf.byteLength > CONFIG.previewMaxBytes) throw new Error("preview exceeds " + CONFIG.previewMaxBytes + " bytes");
		return new Uint8Array(buf);
	}
	function exists(path) {
		return existsSync(path);
	}
	function dirOf(file) {
		const slash = normalize(file);
		const idx = slash.lastIndexOf("/");
		return idx >= 0 ? slash.slice(0, idx) : slash;
	}
	/** 读取所有显示器的壁纸条目 + 最近选中的显示器 */
	function readEntries(weDir) {
		const root = JSON.parse(readText(weDir + "/config.json").replace(/^\uFEFF/, ""));
		let cfg = null;
		for (const key of Object.keys(root)) {
			const value = root[key];
			if (value !== null && typeof value === "object" && value.general !== void 0) {
				cfg = value;
				break;
			}
		}
		const general = cfg?.general ?? {};
		const sel = (general.wallpaperconfig ?? {}).selectedwallpapers ?? {};
		const entries = {};
		for (const key of Object.keys(sel)) {
			if (!key.startsWith("Monitor")) continue;
			const value = sel[key];
			if (value === null || typeof value !== "object") continue;
			const file = value.file;
			if (typeof file === "string" && file.length > 0) entries[key] = { file };
		}
		const browser = general.browser ?? {};
		return {
			entries,
			last: typeof browser.lastselectedmonitor === "string" ? browser.lastselectedmonitor : ""
		};
	}
	/** workshopcache 的 workshopid → {title, type} 映射（一次解析，全体复用） */
	function readCacheMeta(weDir) {
		const map = /* @__PURE__ */ new Map();
		try {
			const cache = JSON.parse(readText(weDir + "/bin/workshopcache.json"));
			for (const w of cache.wallpapers ?? []) if (w.workshopid !== void 0 && w.workshopid !== null) map.set(String(w.workshopid), {
				title: String(w.title ?? ""),
				type: String(w.type ?? "")
			});
		} catch {}
		return map;
	}
	function resolveMeta(file, workshopDir, cacheMap) {
		const slash = normalize(file);
		const match = /431960\/(\d+)/.exec(slash);
		const id = (match !== null ? match[1] : "") ?? "";
		let title = "";
		let type = "";
		const cached = id !== "" ? cacheMap.get(id) : void 0;
		if (cached !== void 0) {
			title = cached.title;
			type = cached.type;
		}
		if (title === "") try {
			const base = id !== "" ? workshopDir + "/" + id : dirOf(slash);
			const project = JSON.parse(readText(base + "/project.json"));
			if (project !== null && typeof project === "object") {
				if (project.title !== void 0) title = String(project.title);
				if (type === "" && project.type !== void 0) type = String(project.type);
			}
		} catch {}
		if (title === "") title = id !== "" ? id : slash.slice(slash.lastIndexOf("/") + 1);
		return {
			title,
			type,
			id
		};
	}
	function probePreview(dir) {
		for (const [name, mime] of [
			["preview.jpg", "image/jpeg"],
			["preview.png", "image/png"],
			["preview.gif", "image/gif"]
		]) {
			const path = dir + "/" + name;
			try {
				if (exists(path)) return {
					path,
					mime
				};
			} catch {}
		}
		return null;
	}
	/** 重建全量显示器信息 + 每台预览缓存；识别"最近变化"的显示器 */
	function refresh(entries, last, weDir, workshopDir) {
		state.lastError = "";
		const prev = state.snapshot;
		state.snapshot = entries;
		let changedKey = null;
		for (const key of Object.keys(entries)) {
			const entry = entries[key];
			if (entry === void 0) continue;
			const prevEntry = prev === null ? void 0 : prev[key];
			if (prevEntry === void 0 || prevEntry.file !== entry.file) {
				changedKey = key;
				break;
			}
		}
		if (changedKey === null && prev !== null) {
			for (const key of Object.keys(prev)) if (entries[key] === void 0) {
				changedKey = key;
				break;
			}
		}
		if (changedKey !== null) state.latestMonitor = changedKey;
		if (state.latestMonitor === "" || entries[state.latestMonitor] === void 0) state.latestMonitor = entries[last] !== void 0 ? last : Object.keys(entries)[0] ?? "";
		const cacheMap = readCacheMeta(weDir);
		state.monitors = Object.keys(entries).flatMap((key) => {
			const entry = entries[key];
			if (entry === void 0) return [];
			const meta = resolveMeta(entry.file, workshopDir, cacheMap);
			return [{
				key,
				file: entry.file,
				title: meta.title,
				type: meta.type
			}];
		});
		const previews = {};
		for (const monitor of state.monitors) {
			let info = {
				bytes: null,
				mime: "",
				kind: "none"
			};
			if (!/^https?:\/\//i.test(monitor.file)) {
				const preview = probePreview(dirOf(monitor.file));
				if (preview !== null) try {
					info = {
						bytes: readBytes(preview.path),
						mime: preview.mime,
						kind: "image"
					};
				} catch (e) {
					state.lastError = String(e.message ?? e);
				}
			} else info = {
				bytes: null,
				mime: "",
				kind: "web"
			};
			previews[monitor.key] = info;
		}
		state.previews = previews;
		state.version += 1;
	}
	function poll(weDir) {
		if (weDir === "") return;
		try {
			const { entries, last } = readEntries(weDir);
			if (JSON.stringify(entries) !== JSON.stringify(state.snapshot)) refresh(entries, last, weDir, resolveWorkshopDir(weDir));
		} catch (e) {
			state.lastError = String(e.message ?? e);
		}
	}
	function sendJson(res, body) {
		res.statusCode = 200;
		res.setHeader("Content-Type", "application/json; charset=utf-8");
		res.setHeader("Cache-Control", "no-store");
		res.end(JSON.stringify(body));
	}
	function monitorFromQuery(req) {
		const match = /[?&]monitor=([^&]+)/.exec(req.url ?? "");
		if (match === null || match[1] === void 0) return "";
		try {
			return decodeURIComponent(match[1]);
		} catch {
			return "";
		}
	}
	function effectiveKey(locked) {
		const keys = state.monitors.map((m) => m.key);
		if (keys.includes(locked)) return locked;
		if (state.latestMonitor !== "" && keys.includes(state.latestMonitor)) return state.latestMonitor;
		return keys[0] ?? "";
	}
	disposers.push(webServer.register({
		kind: "exact",
		path: "/we-sync/state",
		handler(req, res) {
			const key = effectiveKey(monitorFromQuery(req));
			const monitor = state.monitors.find((m) => m.key === key);
			const preview = key !== "" ? state.previews[key] : void 0;
			sendJson(res, {
				version: state.version,
				kind: preview !== void 0 ? preview.kind : "none",
				hash: monitor !== void 0 ? key + "|" + monitor.file : "none",
				monitor: key,
				latestMonitor: state.latestMonitor,
				monitors: state.monitors.length > 1 ? state.monitors : [],
				wallpaper: monitor !== void 0 ? {
					title: monitor.title,
					type: monitor.type
				} : null
			});
		}
	}));
	disposers.push(webServer.register({
		kind: "exact",
		path: "/we-sync/diag",
		handler(_req, res) {
			sendJson(res, {
				version: state.version,
				latestMonitor: state.latestMonitor,
				monitorCount: state.monitors.length,
				monitors: state.monitors.map((m) => ({
					key: m.key,
					file: m.file
				})),
				lastError: state.lastError,
				weDir: state.weDir
			});
		}
	}));
	disposers.push(webServer.register({
		kind: "exact",
		path: "/we-sync/preview",
		handler(req, res) {
			const key = effectiveKey(monitorFromQuery(req));
			const preview = key !== "" ? state.previews[key] : void 0;
			if (preview === void 0 || preview.bytes === null) {
				res.statusCode = 404;
				res.end("no preview: " + state.lastError);
				return;
			}
			res.statusCode = 200;
			res.setHeader("Content-Type", preview.mime);
			res.setHeader("Cache-Control", "no-store");
			res.end(Buffer.from(preview.bytes));
		}
	}));
	const detected = detectWeDir();
	if (detected === null) {
		state.lastError = "未找到 Wallpaper Engine 安装目录：请在 we-sync-dsh 包源码的 CONFIG.wallpaperEngineDir 手动指定";
		return;
	}
	state.weDir = detected;
	ctx.effect(() => {
		const timer = setInterval(() => poll(detected), CONFIG.pollIntervalMs);
		poll(detected);
		return () => clearInterval(timer);
	});
}
//#endregion
export { apply, inject };
