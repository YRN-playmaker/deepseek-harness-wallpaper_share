window.__ModuleLoader__.load({
	id: "we-sync-dsh",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/WallpaperSharePanel.tsx
		/**
		* wallpaper_share 会话视图标签页：当前壁纸信息、同步开关、显示器选择、
		* 专注模式、渲染模式，以及透明度 / 模糊 / 阴影三个滑块（即时生效）。
		* 样式类名由 PANEL_CSS 在 apply 阶段注入，不依赖 CSS Modules。
		*/
		function WallpaperSharePanel() {
			const [, force] = (0, react.useState)(0);
			const [info, setInfo] = (0, react.useState)(store.info);
			const [enabled, setEnabled] = (0, react.useState)(store.settings.enabled);
			const [alpha, setAlpha] = (0, react.useState)(store.settings.panelAlpha);
			const [blur, setBlur] = (0, react.useState)(store.settings.blur);
			const [shadow, setShadow] = (0, react.useState)(store.settings.shadow);
			const [status, setStatus] = (0, react.useState)("");
			const [monitor, setMonitor] = (0, react.useState)(store.settings.monitor);
			const [focus, setFocus] = (0, react.useState)(store.settings.focus);
			const [renderMode, setRenderMode] = (0, react.useState)(store.settings.renderMode);
			(0, react.useEffect)(() => store.subscribe(() => {
				setInfo(store.info);
				force((x) => x + 1);
			}), []);
			const flash = (text) => {
				setStatus(text);
				window.setTimeout(() => setStatus(""), 3500);
			};
			const onAlpha = (v) => {
				store.settings.panelAlpha = v;
				setAlpha(v);
				store.actions.applyTheme();
			};
			const onBlur = (v) => {
				store.settings.blur = v;
				setBlur(v);
				store.actions.applyBackground();
			};
			const onShadow = (v) => {
				store.settings.shadow = v;
				setShadow(v);
				store.actions.applyBackground();
			};
			const onPower = () => {
				const next = !store.settings.enabled;
				store.settings.enabled = next;
				setEnabled(next);
				store.actions.applyBackground();
				flash(next ? "已开启壁纸同步" : "已关闭壁纸同步");
			};
			const onMonitor = (v) => {
				store.settings.monitor = v;
				setMonitor(v);
				store.actions.repoll();
			};
			const onFocus = () => {
				const next = !store.settings.focus;
				store.settings.focus = next;
				setFocus(next);
				store.actions.applyTheme();
				store.actions.applyBackground();
				flash(next ? "专注模式已开启：任务中 30%/15px/90%，空闲 9%/6px/40%" : "专注模式已关闭，恢复手动滑块");
			};
			const onRenderMode = () => {
				const next = store.settings.renderMode === "source" ? "preview" : "source";
				store.settings.renderMode = next;
				setRenderMode(next);
				store.actions.applyBackground();
				if (next === "source") {
					const kind = store.info !== null ? store.info.source.kind : "";
					if (kind === "video") flash("增强模式：播放壁纸源视频");
					else if (kind === "web") flash("增强模式：加载 Web 壁纸页面");
					else flash("当前壁纸（" + (kind === "" ? "无" : kind) + "）仅支持预览，增强模式自动回退");
				} else flash("性能模式：使用静态预览图");
			};
			const wallpaper = info !== null && info.wallpaper !== null ? info.wallpaper : null;
			const title = wallpaper === null ? info !== null && info.kind === "web" ? "当前为网页壁纸（无本地预览）" : "Wallpaper Engine 尚未应用壁纸" : wallpaper.title;
			const subtitle = wallpaper === null ? "在 Wallpaper Engine 中应用壁纸后，此处会同步显示" : wallpaper.type + (info !== null && info.kind === "image" ? " · 已同步静态预览" : " · 无静态预览图") + (info !== null && info.monitor !== "" ? " · 显示器 " + info.monitor : "");
			const monitors = info !== null && Array.isArray(info.monitors) && info.monitors.length > 1 ? info.monitors : null;
			const focusVisuals = focus ? store.settings.taskActive ? FOCUS_WORK : FOCUS_IDLE : null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wesync-panel",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wesync-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wesync-title",
							children: title
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wesync-sub",
							children: subtitle
						}),
						monitors !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wesync-row",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "背景显示器" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "wesync-select",
									value: monitor,
									onChange: (e) => onMonitor(e.target.value),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: "自动 · 跟随最新变化"
									}), monitors.map((m) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: m.key,
										children: m.key + " · " + m.title
									}, m.key))]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("output", { children: monitor === "" ? "auto" : monitor })
							]
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wesync-actions",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "wesync-btn",
								onClick: onPower,
								children: enabled ? "⏻ 同步开启" : "⏻ 同步关闭"
							})
						}),
						status !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wesync-status",
							children: status
						}) : null
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wesync-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wesync-sub",
							children: "视觉效果 · 即时生效"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wesync-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ["wesync-btn", focus ? "wesync-focusOn" : "wesync-focusOff"].join(" "),
								onClick: onFocus,
								children: focus ? store.settings.taskActive ? "专注模式 · 任务进行中" : "专注模式 · 已完成" : "开启专注模式"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ["wesync-btn", renderMode === "source" ? "wesync-sourceOn" : "wesync-sourceOff"].join(" "),
								onClick: onRenderMode,
								children: renderMode === "source" ? "渲染：增强（源文件）" : "渲染：性能（预览）"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
							label: "面板透明度",
							min: 0,
							max: 100,
							value: focusVisuals !== null ? focusVisuals.panelAlpha : alpha,
							unit: "%",
							disabled: focusVisuals !== null,
							onChange: onAlpha
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
							label: "背景模糊",
							min: 0,
							max: 30,
							value: focusVisuals !== null ? focusVisuals.blur : blur,
							unit: "px",
							disabled: focusVisuals !== null,
							onChange: onBlur
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
							label: "阴影深度",
							min: 0,
							max: 100,
							value: focusVisuals !== null ? focusVisuals.shadow : shadow,
							unit: "%",
							disabled: focusVisuals !== null,
							onChange: onShadow
						})
					]
				})]
			});
		}
		function Slider(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wesync-row",
				style: props.disabled === true ? { opacity: .45 } : void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: props.label }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "range",
						min: props.min,
						max: props.max,
						step: 1,
						value: props.value,
						disabled: props.disabled,
						onChange: (e) => props.onChange(Number(e.target.value))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("output", { children: String(props.value) + props.unit })
				]
			});
		}
		//#endregion
		//#region src/client/panelStyle.ts
		/**
		* 面板样式（独立构建不再依赖 CSS Modules，运行时注入 <style>）。
		*/
		const PANEL_CSS = `
.wesync-panel {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 660px;
  box-sizing: border-box;
}

.wesync-card {
  padding: 16px 18px;
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
}

.wesync-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  margin: 0 0 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wesync-sub {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}

.wesync-status {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  margin-top: 10px;
}

.wesync-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.wesync-btn {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
}

.wesync-btn:hover:not(:disabled) {
  background: var(--dsw-alias-bg-overlay);
}

.wesync-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.wesync-focusOff {
  background: rgba(139, 92, 246, 0.18);
  border-color: rgba(139, 92, 246, 0.55);
  color: #c4b5fd;
}

.wesync-focusOff:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.32);
}

.wesync-focusOn {
  background: rgba(46, 160, 67, 0.20);
  border-color: rgba(46, 160, 67, 0.55);
  color: #7ee2a8;
}

.wesync-focusOn:hover:not(:disabled) {
  background: rgba(46, 160, 67, 0.32);
}

.wesync-sourceOff {
  background: rgba(249, 115, 22, 0.15);
  border-color: rgba(249, 115, 22, 0.5);
  color: #fdba74;
}

.wesync-sourceOff:hover:not(:disabled) {
  background: rgba(249, 115, 22, 0.28);
}

.wesync-sourceOn {
  background: rgba(46, 160, 67, 0.20);
  border-color: rgba(46, 160, 67, 0.55);
  color: #7ee2a8;
}

.wesync-sourceOn:hover:not(:disabled) {
  background: rgba(46, 160, 67, 0.32);
}

.wesync-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.wesync-row label {
  flex: 0 0 92px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}

.wesync-row input[type='range'] {
  flex: 1;
  accent-color: var(--dsw-alias-brand-primary);
  height: 20px;
}

.wesync-select {
  flex: 1;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  font-family: inherit;
}

.wesync-row output {
  flex: 0 0 44px;
  text-align: right;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
`;
		//#endregion
		//#region src/client/index.ts
		/**
		* we-sync · browser half
		* 玻璃面板主题覆盖 + 壁纸背景层 + wallpaper_share 会话视图标签页。
		* 与 node half 通过同源 HTTP 路由（/we-sync/state、/we-sync/preview、
		* /we-sync/random）通信，不依赖任何 RPC 基础设施。
		* 多显示器：?monitor= 锁定某台；不传则跟随"最近变化"的一台。
		*/
		const inject = ["slots", "theme"];
		/** 专注模式：任务进行中 */
		const FOCUS_WORK = {
			panelAlpha: 30,
			blur: 15,
			shadow: 90
		};
		/** 专注模式：任务全部完成 */
		const FOCUS_IDLE = {
			panelAlpha: 9,
			blur: 6,
			shadow: 40
		};
		/** 当前生效的视觉参数（专注模式覆盖用户滑块值） */
		function effectiveVisuals() {
			if (store.settings.focus) return store.settings.taskActive ? FOCUS_WORK : FOCUS_IDLE;
			return {
				panelAlpha: store.settings.panelAlpha,
				blur: store.settings.blur,
				shadow: store.settings.shadow
			};
		}
		/** 包内单例 store：apply 循环更新，面板组件订阅渲染。 */
		const store = {
			info: null,
			settings: {
				enabled: true,
				panelAlpha: 72,
				blur: 6,
				shadow: 30,
				monitor: "",
				focus: false,
				taskActive: false,
				renderMode: "preview"
			},
			listeners: /* @__PURE__ */ new Set(),
			actions: {
				applyTheme: () => {},
				applyBackground: () => {},
				repoll: () => {}
			},
			subscribe(fn) {
				store.listeners.add(fn);
				return () => {
					store.listeners.delete(fn);
				};
			},
			notify() {
				for (const fn of store.listeners) fn();
			}
		};
		function apply(ctx) {
			const theme = ctx.get("theme");
			const slots = ctx.get("slots");
			if (theme === void 0 || slots === void 0) return;
			const themeService = theme;
			const slotsService = slots;
			let themeDisposer = null;
			function applyTheme() {
				if (themeDisposer !== null) {
					themeDisposer();
					themeDisposer = null;
				}
				const a = .3 + effectiveVisuals().panelAlpha / 100 * .6;
				const dark = {
					"--dsw-alias-bg-base": "rgba(15,16,20," + a.toFixed(3) + ")",
					"--dsw-alias-bg-layer-1": "rgba(24,26,32," + (a * .95).toFixed(3) + ")",
					"--dsw-alias-bg-layer-2": "rgba(31,33,40," + (a * .9).toFixed(3) + ")",
					"--dsw-alias-bg-overlay": "rgba(22,24,29," + Math.min(a + .12, .96).toFixed(3) + ")",
					"--dsw-specific-sidebar-fill": "rgba(13,14,17," + (a * .92).toFixed(3) + ")"
				};
				const light = {
					"--dsw-alias-bg-base": "rgba(246,247,250," + Math.min(a + .1, .95).toFixed(3) + ")",
					"--dsw-alias-bg-layer-1": "rgba(255,255,255," + (a * .95).toFixed(3) + ")",
					"--dsw-alias-bg-layer-2": "rgba(251,252,253," + (a * .9).toFixed(3) + ")",
					"--dsw-alias-bg-overlay": "rgba(255,255,255," + Math.min(a + .14, .97).toFixed(3) + ")",
					"--dsw-specific-sidebar-fill": "rgba(238,240,244," + (a * .92).toFixed(3) + ")"
				};
				const tokens = {};
				for (const key of Object.keys(dark)) tokens[key] = {
					light: light[key] ?? "",
					dark: dark[key] ?? ""
				};
				themeDisposer = themeService.overrideTokens("we-sync", tokens);
			}
			const styleTag = document.createElement("style");
			styleTag.dataset.plugin = "we-sync-dsh";
			document.head.appendChild(styleTag);
			const panelStyleTag = document.createElement("style");
			panelStyleTag.dataset.plugin = "we-sync-dsh";
			panelStyleTag.textContent = PANEL_CSS;
			document.head.appendChild(panelStyleTag);
			let mediaEl = null;
			function setMedia(el) {
				if (mediaEl !== null && mediaEl !== el) {
					if (mediaEl instanceof HTMLVideoElement) mediaEl.pause();
					mediaEl.remove();
				}
				mediaEl = el;
				if (el !== null) {
					el.style.position = "fixed";
					el.style.top = "0";
					el.style.left = "0";
					el.style.width = "100%";
					el.style.height = "100%";
					el.style.zIndex = "-2";
					el.style.pointerEvents = "none";
					el.style.border = "0";
					document.body.appendChild(el);
				}
			}
			function applyBackground() {
				const info = store.info;
				const visuals = effectiveVisuals();
				const enabled = store.settings.enabled;
				const blurPx = Math.round(visuals.blur);
				const scale = 1 + blurPx / 400;
				const shadowAlpha = visuals.shadow / 100 * .6;
				const monitorKey = info !== null && info.monitor !== "" ? info.monitor : "";
				const monitorQuery = store.settings.monitor !== "" ? "&monitor=" + encodeURIComponent(store.settings.monitor) : "";
				const sourceKind = enabled && info !== null && store.settings.renderMode === "source" ? info.source.kind : "";
				let imgUrl = "none";
				if (enabled && info !== null && info.kind === "image" && sourceKind === "") imgUrl = "url(\"/we-sync/preview?v=" + info.version + monitorQuery + "\")";
				styleTag.textContent = "html { background-color: #0d0e12; }" + (imgUrl !== "none" ? "body::before { content: \"\"; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -2; background-image: " + imgUrl + "; background-size: cover; background-position: center; background-repeat: no-repeat; filter: blur(" + blurPx + "px); transform: scale(" + scale.toFixed(3) + "); transition: filter 0.12s linear; }" : "") + "body::after { content: \"\"; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -1; background: linear-gradient(rgba(6,8,12," + shadowAlpha.toFixed(3) + "), rgba(6,8,12," + (shadowAlpha * .85).toFixed(3) + ")); }";
				if (sourceKind === "video" && info !== null) {
					let video = mediaEl instanceof HTMLVideoElement ? mediaEl : null;
					if (video === null) {
						video = document.createElement("video");
						video.muted = true;
						video.loop = true;
						video.playsInline = true;
						video.autoplay = true;
						setMedia(video);
					}
					const src = "/we-sync/source?monitor=" + encodeURIComponent(monitorKey) + "&v=" + info.version;
					if (video.src !== location.origin + src) video.src = src;
					video.style.filter = "blur(" + blurPx + "px)";
					video.style.transform = "scale(" + scale.toFixed(3) + ")";
					video.style.objectFit = "cover";
					const p = video.play();
					if (p !== void 0 && p !== null) p.catch(() => {});
				} else if (sourceKind === "web" && info !== null) {
					let frame = mediaEl instanceof HTMLIFrameElement ? mediaEl : null;
					if (frame === null) {
						frame = document.createElement("iframe");
						frame.setAttribute("sandbox", "allow-scripts");
						setMedia(frame);
					}
					const src = "/we-sync/wallpaper/index.html?monitor=" + encodeURIComponent(monitorKey) + "&v=" + info.version;
					if (frame.src !== location.origin + src) frame.src = src;
					frame.style.filter = "blur(" + blurPx + "px)";
				} else setMedia(null);
			}
			let polling = false;
			let lastHash = "";
			async function poll() {
				if (polling) return;
				polling = true;
				try {
					const monitorQuery = store.settings.monitor !== "" ? "?monitor=" + encodeURIComponent(store.settings.monitor) : "";
					const res = await fetch("/we-sync/state" + monitorQuery, { cache: "no-store" });
					if (!res.ok) return;
					const info = await res.json();
					const changed = typeof info.hash === "string" && info.hash !== lastHash;
					store.info = info;
					store.notify();
					if (changed) {
						lastHash = info.hash;
						applyBackground();
					}
				} catch {}
				polling = false;
			}
			store.actions.applyTheme = applyTheme;
			store.actions.applyBackground = applyBackground;
			store.actions.repoll = () => {
				lastHash = "";
				poll();
			};
			ctx.effect(() => () => {
				styleTag.remove();
				panelStyleTag.remove();
				setMedia(null);
				if (themeDisposer !== null) {
					themeDisposer();
					themeDisposer = null;
				}
			});
			ctx.effect(() => {
				const timer = setInterval(() => {
					poll();
				}, 2500);
				poll();
				return () => clearInterval(timer);
			});
			const sessions = ctx.get("sessions");
			if (sessions !== void 0) {
				const updateTaskState = () => {
					const snapshot = sessions.list.getSnapshot();
					const id = snapshot?.current;
					const active = id !== void 0 && snapshot !== null && snapshot.byId[id]?.running === true;
					if (active !== store.settings.taskActive) {
						store.settings.taskActive = active;
						if (store.settings.focus) {
							applyTheme();
							applyBackground();
						}
						store.notify();
					}
				};
				ctx.effect(() => sessions.list.subscribe(updateTaskState));
				updateTaskState();
			}
			applyTheme();
			applyBackground();
			slotsService.inject("conversation.view", () => slotsService.register({
				name: "conversation.view",
				id: "wallpaper_share",
				order: 20,
				label: "wallpaper_share"
			}, WallpaperSharePanel));
		}
		//#endregion
		exports.FOCUS_IDLE = FOCUS_IDLE;
		exports.FOCUS_WORK = FOCUS_WORK;
		exports.apply = apply;
		exports.effectiveVisuals = effectiveVisuals;
		exports.inject = inject;
		exports.store = store;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map