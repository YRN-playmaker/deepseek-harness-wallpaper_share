import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
//#region src/index.ts
/**
* dsh-wallpaper_share · node half（内部 id / 路由前缀仍为 we-sync）
* Wallpaper Engine ↔ DSH 壁纸同步（纯显示）：轮询 WE 的 config.json，
* 通过 HTTP 路由提供当前壁纸状态、预览图与增强模式源文件。
* 多显示器：跟踪所有条目，默认跟随"最近变化"的一台；客户端可用
* ?monitor= 参数锁定某台。
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
	/** 按扩展名判断源文件能否被浏览器直接渲染 */
	function sourceKindOf(file) {
		const lower = normalize(file).toLowerCase();
		if (lower.endsWith(".mp4")) return {
			kind: "video",
			mime: "video/mp4"
		};
		if (lower.endsWith(".webm")) return {
			kind: "video",
			mime: "video/webm"
		};
		if (lower.endsWith(".mov")) return {
			kind: "video",
			mime: "video/quicktime"
		};
		if (lower.endsWith(".avi")) return {
			kind: "video",
			mime: "video/x-msvideo"
		};
		if (lower.endsWith(".mkv")) return {
			kind: "video",
			mime: "video/x-matroska"
		};
		if (lower.endsWith(".html") || lower.endsWith(".htm")) return {
			kind: "web",
			mime: "text/html"
		};
		if (lower.endsWith(".pkg")) return {
			kind: "scene",
			mime: ""
		};
		if (lower.endsWith(".exe")) return {
			kind: "application",
			mime: ""
		};
		if (lower.endsWith(".png")) return {
			kind: "image",
			mime: "image/png"
		};
		if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return {
			kind: "image",
			mime: "image/jpeg"
		};
		if (lower.endsWith(".gif")) return {
			kind: "image",
			mime: "image/gif"
		};
		if (lower.endsWith(".webp")) return {
			kind: "image",
			mime: "image/webp"
		};
		return {
			kind: "other",
			mime: ""
		};
	}
	/** 从 scene.pkg（Wallpaper Engine 私有 PKGV 容器）中扫描最大的一张 JPEG/PNG 纹理。
	*  scene 壁纸的真实画面由 WE 引擎（shader / 粒子 / 纹理）渲染，浏览器无法执行；
	*  这里提取内嵌背景纹理的 mipmap 链中最高清的一张，作为增强模式的近似背景。 */
	function scanPkgImage(file) {
		let buf;
		try {
			buf = readFileSync(file);
		} catch {
			return null;
		}
		let best = null;
		const consider = (start, end, mime, w, h) => {
			if (w < 64 || h < 64 || w > 16384 || h > 16384) return;
			const area = w * h;
			if (best === null || area > best.width * best.height) best = {
				start,
				end,
				mime,
				width: w,
				height: h
			};
		};
		let pos = 0;
		while (pos < buf.length - 4) {
			if (buf[pos] === 255 && buf[pos + 1] === 216 && buf[pos + 2] === 255) {
				let scan = pos + 2;
				let w = 0;
				let h = 0;
				for (let guard = 0; scan < buf.length - 9 && guard < 64; guard++) {
					if (buf[scan] !== 255) {
						scan++;
						continue;
					}
					const marker = buf[scan + 1];
					if (marker === 216 || marker >= 208 && marker <= 215) {
						scan += 2;
						continue;
					}
					const len = buf.readUInt16BE(scan + 2);
					if (len < 2) break;
					if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) {
						h = buf.readUInt16BE(scan + 5);
						w = buf.readUInt16BE(scan + 7);
						break;
					}
					scan += 2 + len;
				}
				if (w > 0 && h > 0) {
					const eoi = buf.indexOf(Buffer.from([255, 217]), scan);
					const end = eoi >= 0 ? eoi + 1 : buf.length - 1;
					consider(pos, end, "image/jpeg", w, h);
					pos = end;
					continue;
				}
			}
			if (buf[pos] === 137 && buf[pos + 1] === 80 && buf[pos + 2] === 78 && buf[pos + 3] === 71 && buf.readUInt32BE(pos + 12) === 1229472850) {
				const w = buf.readUInt32BE(pos + 16);
				const h = buf.readUInt32BE(pos + 20);
				const iend = buf.indexOf(Buffer.from("49454e44ae426082", "hex"), pos);
				const end = iend >= 0 ? iend + 7 : buf.length - 1;
				consider(pos, end, "image/png", w, h);
				pos = end;
				continue;
			}
			pos++;
		}
		return best;
	}
	function mimeOfPath(path) {
		const lower = normalize(path).toLowerCase();
		if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html; charset=utf-8";
		if (lower.endsWith(".css")) return "text/css; charset=utf-8";
		if (lower.endsWith(".js")) return "application/javascript; charset=utf-8";
		if (lower.endsWith(".json")) return "application/json; charset=utf-8";
		if (lower.endsWith(".png")) return "image/png";
		if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
		if (lower.endsWith(".gif")) return "image/gif";
		if (lower.endsWith(".webp")) return "image/webp";
		if (lower.endsWith(".svg")) return "image/svg+xml";
		if (lower.endsWith(".woff2")) return "font/woff2";
		if (lower.endsWith(".woff")) return "font/woff";
		if (lower.endsWith(".ttf")) return "font/ttf";
		if (lower.endsWith(".mp4")) return "video/mp4";
		if (lower.endsWith(".webm")) return "video/webm";
		if (lower.endsWith(".mp3")) return "audio/mpeg";
		if (lower.endsWith(".wav")) return "audio/wav";
		return "application/octet-stream";
	}
	/** 读取壁纸 project.json 的 general.properties 默认值，构造 WE applyUserProperties 入参 */
	function buildWallpaperProps(dir) {
		try {
			const project = JSON.parse(readText(dir + "/project.json"));
			const props = {};
			for (const key of Object.keys(project?.general?.properties ?? {})) {
				const p = project.general?.properties?.[key];
				if (p !== void 0 && "value" in p) props[key] = { value: p.value };
			}
			if (project?.general?.properties?.modelresolution !== void 0) {
				for (const res of [
					"2k",
					"4k",
					"8k"
				]) if (exists(dir + "/assets/" + res)) {
					props.modelresolution = { value: res };
					break;
				}
			}
			if (Object.keys(props).length > 0) return props;
		} catch {}
		return { introanimation: { value: true } };
	}
	/** 注入到壁纸页面里的 WE 环境 shim：复刻 WE 默认环境（html/body 铺满黑底 + 主 canvas 全屏），
	*  并等 wallpaperPropertyListener 注册后自动调用 applyUserProperties */
	function wallpaperShim(props) {
		return "<style>html,body{width:100%;height:100%;overflow:hidden;background:#000;margin:0;padding:0}</style><script>(function(){var c=document.getElementById(\"canvas\");if(c&&getComputedStyle(c).position===\"static\"){c.style.position=\"fixed\";c.style.top=\"0\";c.style.left=\"0\";c.style.width=\"100%\";c.style.height=\"100%\"};" + ("var p=" + JSON.stringify(props).replace(/</g, "\\u003c") + ";var f=function(){if(window.wallpaperPropertyListener&&typeof window.wallpaperPropertyListener.applyUserProperties===\"function\"){window.wallpaperPropertyListener.applyUserProperties(p);return true}return false};if(!f()){var n=0;var t=setInterval(function(){n++;if(f()||n>200)clearInterval(t)},50)}") + "})();<\\/script>";
	}
	/** 伺服 web 壁纸文件；HTML 注入 WE 属性 shim（否则 introAnimation 等属性永远 undefined，渲染被卡住） */
	function serveWebFile(dir, target, req, res) {
		const lower = target.toLowerCase();
		if (lower.endsWith(".html") || lower.endsWith(".htm")) try {
			const html = readText(target);
			const shim = wallpaperShim(buildWallpaperProps(dir));
			const injected = html.replace(/<\/body>/i, shim + "</body>");
			const out = injected === html ? html + shim : injected;
			res.statusCode = 200;
			res.setHeader("Content-Type", "text/html; charset=utf-8");
			res.setHeader("Cache-Control", "no-store");
			res.end(out);
			return;
		} catch {}
		serveFile(target, mimeOfPath(target), req, res);
	}
	/** 解析 HTTP Range 头；返回 undefined=无 Range，null=非法范围，否则为闭区间 */
	function parseRange(header, total) {
		if (typeof header !== "string") return void 0;
		const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
		if (m === null) return void 0;
		const left = m[1] ?? "";
		const right = m[2] ?? "";
		if (left === "" && right === "") return null;
		let start;
		let end;
		if (left === "") {
			const n = Number(right);
			if (!Number.isFinite(n) || n <= 0) return null;
			start = Math.max(0, total - n);
			end = total - 1;
		} else {
			start = Number(left);
			if (!Number.isFinite(start) || start < 0 || start >= total) return null;
			end = right === "" ? total - 1 : Math.min(Number(right), total - 1);
			if (!Number.isFinite(end) || end < start) return null;
		}
		return {
			start,
			end
		};
	}
	/** 流式返回文件（视频等大文件不能整读进内存），支持 HTTP Range 以便视频可 seek/播放 */
	function serveFile(path, mime, req, res) {
		let info;
		try {
			info = statSync(path);
		} catch {
			res.statusCode = 404;
			res.end("not found");
			return;
		}
		if (!info.isFile()) {
			res.statusCode = 404;
			res.end("not found");
			return;
		}
		const total = info.size;
		res.setHeader("Accept-Ranges", "bytes");
		res.setHeader("Content-Type", mime);
		res.setHeader("Cache-Control", "no-store");
		const range = parseRange(req.headers?.range, total);
		if (range === null) {
			res.statusCode = 416;
			res.setHeader("Content-Range", "bytes */" + total);
			res.end();
			return;
		}
		if (range !== void 0) {
			res.statusCode = 206;
			res.setHeader("Content-Range", "bytes " + range.start + "-" + range.end + "/" + total);
			res.setHeader("Content-Length", String(range.end - range.start + 1));
			const stream = createReadStream(path, {
				start: range.start,
				end: range.end
			});
			stream.on("error", () => {
				try {
					res.end();
				} catch {}
			});
			stream.pipe(res);
			return;
		}
		res.statusCode = 200;
		res.setHeader("Content-Length", String(total));
		const stream = createReadStream(path);
		stream.on("error", () => {
			try {
				res.end();
			} catch {}
		});
		stream.pipe(res);
	}
	/** 流式返回文件的一个字节切片（用于从 scene.pkg 内提取纹理），支持 HTTP Range */
	function serveSlice(path, start, end, mime, req, res) {
		const total = end - start + 1;
		res.setHeader("Accept-Ranges", "bytes");
		res.setHeader("Content-Type", mime);
		res.setHeader("Cache-Control", "no-store");
		const range = parseRange(req.headers?.range, total);
		if (range === null) {
			res.statusCode = 416;
			res.setHeader("Content-Range", "bytes */" + total);
			res.end();
			return;
		}
		if (range !== void 0) {
			res.statusCode = 206;
			res.setHeader("Content-Range", "bytes " + range.start + "-" + range.end + "/" + total);
			res.setHeader("Content-Length", String(range.end - range.start + 1));
			const stream = createReadStream(path, {
				start: start + range.start,
				end: start + range.end
			});
			stream.on("error", () => {
				try {
					res.end();
				} catch {}
			});
			stream.pipe(res);
			return;
		}
		res.statusCode = 200;
		res.setHeader("Content-Length", String(total));
		const stream = createReadStream(path, {
			start,
			end
		});
		stream.on("error", () => {
			try {
				res.end();
			} catch {}
		});
		stream.pipe(res);
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
			const src = sourceKindOf(entry.file);
			let kind = src.kind;
			let mime = src.mime;
			let sourceFile = entry.file;
			let sceneImage = null;
			if (kind === "other") {
				const index = dirOf(entry.file) + "/index.html";
				if (exists(index)) {
					kind = "web";
					mime = "text/html";
					sourceFile = index;
				}
			}
			if (kind === "scene") sceneImage = scanPkgImage(entry.file);
			return [{
				key,
				file: entry.file,
				title: meta.title,
				type: meta.type,
				kind,
				mime,
				sourceFile,
				sceneImage
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
				} : null,
				source: monitor !== void 0 ? {
					kind: monitor.kind,
					mime: monitor.mime,
					scene: monitor.sceneImage !== null
				} : {
					kind: "",
					mime: "",
					scene: false
				},
				webPort
			});
		}
	}));
	disposers.push(webServer.register({
		kind: "exact",
		path: "/we-sync/source",
		handler(req, res) {
			const key = effectiveKey(monitorFromQuery(req));
			const monitor = state.monitors.find((m) => m.key === key);
			if (monitor === void 0) {
				res.statusCode = 404;
				res.end("no wallpaper");
				return;
			}
			if (monitor.kind === "video" || monitor.kind === "image") {
				serveFile(monitor.sourceFile, monitor.mime !== "" ? monitor.mime : "application/octet-stream", req, res);
				return;
			}
			if (monitor.kind === "web") {
				serveFile(monitor.sourceFile, "text/html; charset=utf-8", req, res);
				return;
			}
			res.statusCode = 415;
			res.end("source not renderable: " + monitor.kind);
		}
	}));
	disposers.push(webServer.register({
		kind: "exact",
		path: "/we-sync/scene",
		handler(req, res) {
			const key = effectiveKey(monitorFromQuery(req));
			const monitor = state.monitors.find((m) => m.key === key);
			if (monitor === void 0 || monitor.kind !== "scene" || monitor.sceneImage === null) {
				res.statusCode = 404;
				res.end("no scene image");
				return;
			}
			const img = monitor.sceneImage;
			serveSlice(monitor.sourceFile, img.start, img.end, img.mime, req, res);
		}
	}));
	disposers.push(webServer.register({
		kind: "prefix",
		path: "/we-sync/wallpaper",
		handler(req, res) {
			const key = effectiveKey(monitorFromQuery(req));
			const monitor = state.monitors.find((m) => m.key === key);
			if (monitor === void 0 || monitor.kind !== "web") {
				res.statusCode = 404;
				res.end("no web wallpaper");
				return;
			}
			const dir = normalize(dirOf(monitor.sourceFile));
			const rel = (req.url ?? "").split("?")[0].replace(/^\/we-sync\/wallpaper\//, "");
			const target = normalize(dir + "/" + rel);
			if (!target.startsWith(dir + "/") || target.length <= dir.length + 1) {
				res.statusCode = 403;
				res.end("forbidden");
				return;
			}
			serveWebFile(dir, target, req, res);
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
					file: m.file,
					kind: m.kind,
					sceneImage: m.sceneImage !== null ? {
						width: m.sceneImage.width,
						height: m.sceneImage.height,
						mime: m.sceneImage.mime
					} : null
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
	/** 壁纸源服务器：把当前 web 壁纸目录作为独立源伺服（127.0.0.1 临时端口）。
	*  Spine/WebGL 类壁纸在 iframe 里需要"自己的同源"才能渲染（贴图不 tainted、
	*  ES module / fetch / import() 全通），且与 DSH 主源（3080）隔离，无安全后门。 */
	let sourceServer = null;
	let webPort = 0;
	try {
		sourceServer = createServer((req, res) => {
			const key = effectiveKey(monitorFromQuery(req));
			const monitor = state.monitors.find((m) => m.key === key);
			if (monitor === void 0 || monitor.kind !== "web") {
				res.statusCode = 404;
				res.end("no web wallpaper");
				return;
			}
			const dir = normalize(dirOf(monitor.sourceFile));
			const rel = (req.url ?? "").split("?")[0].replace(/^\/+/, "");
			const target = normalize(dir + "/" + rel);
			if (!target.startsWith(dir + "/") || target.length <= dir.length + 1) {
				res.statusCode = 403;
				res.end("forbidden");
				return;
			}
			serveWebFile(dir, target, req, res);
		});
		sourceServer.listen(0, "127.0.0.1", () => {
			const addr = sourceServer?.address();
			if (addr !== null && typeof addr === "object") webPort = addr.port;
		});
		disposers.push(() => {
			if (sourceServer !== null) try {
				sourceServer.close();
			} catch {}
		});
	} catch {
		webPort = 0;
	}
	const detected = detectWeDir();
	if (detected === null) {
		state.lastError = "未找到 Wallpaper Engine 安装目录：请在 dsh-wallpaper_share 包源码的 CONFIG.wallpaperEngineDir 手动指定";
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
