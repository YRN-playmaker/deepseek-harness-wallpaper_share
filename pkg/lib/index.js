import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
//#region lib/types/index.js
/**
* we-sync · node half
* Wallpaper Engine ↔ DSH 壁纸同步：轮询 WE 的 config.json，通过 HTTP 路由
* 提供当前壁纸状态与预览图，并支持随机切换（wallpaper64.exe -control）。
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
		fingerprint: "none",
		wallpaper: null,
		previewBytes: null,
		previewMime: "",
		previewKind: "none",
		previewPath: "",
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
	function readSelection(weDir) {
		const root = JSON.parse(readText(weDir + "/config.json").replace(/^\uFEFF/, ""));
		let cfg = null;
		for (const key of Object.keys(root)) {
			const value = root[key];
			if (value !== null && typeof value === "object" && value.general !== void 0) {
				cfg = value;
				break;
			}
		}
		if (cfg === null) return null;
		const general = cfg.general;
		if (general === void 0) return null;
		const sel = (general.wallpaperconfig ?? {}).selectedwallpapers ?? {};
		const entries = [];
		for (const key of Object.keys(sel)) {
			const value = sel[key];
			if (key.startsWith("Monitor") && value !== null && typeof value === "object") entries.push([key, value]);
		}
		if (entries.length === 0) return null;
		const last = (general.browser ?? {}).lastselectedmonitor;
		let chosen = entries[0];
		if (chosen === void 0) return null;
		for (const entry of entries) if (entry[0] === last) {
			chosen = entry;
			break;
		}
		const file = chosen[1].file;
		if (typeof file === "string" && file.length > 0) return { file };
		return null;
	}
	function resolveMeta(file, weDir, workshopDir) {
		const slash = normalize(file);
		const match = /431960\/(\d+)/.exec(slash);
		const id = (match !== null ? match[1] : "") ?? "";
		let title = "";
		let type = "";
		try {
			const cache = JSON.parse(readText(weDir + "/bin/workshopcache.json"));
			const list = Array.isArray(cache.wallpapers) ? cache.wallpapers : [];
			const hit = id !== "" ? list.find((w) => String(w.workshopid) === id) : list.find((w) => typeof w.file === "string" && normalize(w.file) === slash);
			if (hit !== void 0) {
				title = String(hit.title ?? "");
				type = String(hit.type ?? "");
			}
		} catch {}
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
	function refresh(selection, fingerprint, weDir, workshopDir) {
		state.fingerprint = fingerprint;
		state.lastError = "";
		if (selection === null) {
			state.wallpaper = null;
			state.previewBytes = null;
			state.previewKind = "none";
			state.previewPath = "";
			state.version += 1;
			return;
		}
		const file = selection.file;
		if (/^https?:\/\//i.test(file)) {
			state.wallpaper = {
				title: file,
				type: "Web",
				id: ""
			};
			state.previewBytes = null;
			state.previewKind = "web";
			state.previewPath = "";
			state.version += 1;
			return;
		}
		const meta = resolveMeta(file, weDir, workshopDir);
		const preview = probePreview(dirOf(file));
		if (preview === null) {
			state.wallpaper = meta;
			state.previewBytes = null;
			state.previewKind = "none";
			state.previewPath = "";
			state.version += 1;
			return;
		}
		let bytes = null;
		try {
			bytes = readBytes(preview.path);
		} catch (e) {
			state.lastError = String(e.message ?? e);
		}
		if (bytes === null || bytes.byteLength === 0) {
			state.wallpaper = meta;
			state.previewBytes = null;
			state.previewKind = "none";
			state.previewPath = "";
			state.version += 1;
			return;
		}
		state.wallpaper = meta;
		state.previewBytes = bytes;
		state.previewMime = preview.mime;
		state.previewKind = "image";
		state.previewPath = preview.path;
		state.version += 1;
	}
	function poll(weDir) {
		if (weDir === "") return;
		try {
			const selection = readSelection(weDir);
			const fingerprint = selection === null ? "none" : JSON.stringify(selection);
			if (fingerprint !== state.fingerprint) refresh(selection, fingerprint, weDir, resolveWorkshopDir(weDir));
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
	disposers.push(webServer.register({
		kind: "exact",
		path: "/we-sync/state",
		handler(_req, res) {
			sendJson(res, {
				version: state.version,
				kind: state.previewKind,
				wallpaper: state.wallpaper === null ? null : {
					title: state.wallpaper.title,
					type: state.wallpaper.type
				}
			});
		}
	}));
	disposers.push(webServer.register({
		kind: "exact",
		path: "/we-sync/diag",
		handler(_req, res) {
			sendJson(res, {
				version: state.version,
				kind: state.previewKind,
				fingerprint: state.fingerprint,
				previewPath: state.previewPath,
				lastError: state.lastError,
				weDir: state.weDir,
				wallpaper: state.wallpaper === null ? null : {
					title: state.wallpaper.title,
					type: state.wallpaper.type,
					id: state.wallpaper.id
				}
			});
		}
	}));
	disposers.push(webServer.register({
		kind: "exact",
		path: "/we-sync/preview",
		handler(_req, res) {
			if (state.previewBytes === null) {
				res.statusCode = 404;
				res.end("no preview: " + state.lastError);
				return;
			}
			res.statusCode = 200;
			res.setHeader("Content-Type", state.previewMime);
			res.setHeader("Cache-Control", "no-store");
			res.end(Buffer.from(state.previewBytes));
		}
	}));
	disposers.push(webServer.register({
		kind: "exact",
		path: "/we-sync/random",
		handler(_req, res) {
			if (state.weDir === "") {
				sendJson(res, {
					ok: false,
					error: "Wallpaper Engine 安装目录未检测到"
				});
				return;
			}
			try {
				const cache = JSON.parse(readText(state.weDir + "/bin/workshopcache.json"));
				const list = Array.isArray(cache.wallpapers) ? cache.wallpapers : [];
				const ids = [];
				for (const w of list) if (w.workshopid !== void 0 && w.workshopid !== null) ids.push(String(w.workshopid));
				if (ids.length === 0) {
					sendJson(res, {
						ok: false,
						error: "没有可用的已安装壁纸"
					});
					return;
				}
				const pick = ids[Math.floor(Math.random() * ids.length)];
				if (pick === void 0) {
					sendJson(res, {
						ok: false,
						error: "没有可用的已安装壁纸"
					});
					return;
				}
				spawn(state.weDir + "/wallpaper64.exe", [
					"-control",
					"openWallpaper",
					"-workshop",
					pick
				], {
					detached: true,
					stdio: "ignore",
					windowsHide: true
				}).unref();
				sendJson(res, {
					ok: true,
					workshopId: pick
				});
				setTimeout(() => poll(state.weDir), 1500);
			} catch (e) {
				sendJson(res, {
					ok: false,
					error: String(e.message ?? e)
				});
			}
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
