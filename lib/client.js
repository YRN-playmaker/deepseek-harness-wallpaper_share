window.__ModuleLoader__.load({
	id: "we-sync-dsh",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:C:\Users\倪哥儿\Downloads\deepseek-harness-master\packages\client\we-sync\src\client\panel.module.css.mjs
		const css = ".NZBnpG_panel{box-sizing:border-box;flex-direction:column;gap:16px;max-width:660px;padding:24px;display:flex}.NZBnpG_card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:16px 18px}.NZBnpG_title{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;margin:0 0 4px;font-size:15px;font-weight:600;overflow:hidden}.NZBnpG_sub{color:var(--dsw-alias-label-secondary);font-size:12px}.NZBnpG_status{color:var(--dsw-alias-label-secondary);margin-top:10px;font-size:12px}.NZBnpG_actions{gap:8px;margin-top:12px;display:flex}.NZBnpG_btn{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:999px;padding:6px 14px;font-family:inherit;font-size:13px}.NZBnpG_btn:hover:not(:disabled){background:var(--dsw-alias-bg-overlay)}.NZBnpG_btn:disabled{opacity:.5;cursor:default}.NZBnpG_row{align-items:center;gap:12px;margin-top:12px;display:flex}.NZBnpG_row label{color:var(--dsw-alias-label-secondary);flex:0 0 92px;font-size:12px}.NZBnpG_row input[type=range]{accent-color:var(--dsw-alias-brand-primary);flex:1;height:20px}.NZBnpG_select{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;flex:1;padding:4px 8px;font-family:inherit;font-size:12px}.NZBnpG_row output{text-align:right;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;flex:0 0 44px;font-size:12px}";
		const tagId = "we-sync-dsh/panel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "we-sync-dsh";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var panel_module_css_default = {
			"actions": "NZBnpG_actions",
			"row": "NZBnpG_row",
			"btn": "NZBnpG_btn",
			"title": "NZBnpG_title",
			"card": "NZBnpG_card",
			"panel": "NZBnpG_panel",
			"sub": "NZBnpG_sub",
			"status": "NZBnpG_status",
			"select": "NZBnpG_select"
		};
		//#endregion
		//#region src/client/WallpaperSharePanel.tsx
		/**
		* wallpaper_share 会话视图标签页：当前壁纸信息、同步开关、显示器选择，
		* 以及透明度 / 模糊 / 阴影三个滑块（即时生效）。
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
			const wallpaper = info !== null && info.wallpaper !== null ? info.wallpaper : null;
			const title = wallpaper === null ? info !== null && info.kind === "web" ? "当前为网页壁纸（无本地预览）" : "Wallpaper Engine 尚未应用壁纸" : wallpaper.title;
			const subtitle = wallpaper === null ? "在 Wallpaper Engine 中应用壁纸后，此处会同步显示" : wallpaper.type + (info !== null && info.kind === "image" ? " · 已同步静态预览" : " · 无静态预览图") + (info !== null && info.monitor !== "" ? " · 显示器 " + info.monitor : "");
			const monitors = info !== null && Array.isArray(info.monitors) && info.monitors.length > 1 ? info.monitors : null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.panel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.card,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.title,
							children: title
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.sub,
							children: subtitle
						}),
						monitors !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.row,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "背景显示器" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: panel_module_css_default.select,
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
							className: panel_module_css_default.actions,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: panel_module_css_default.btn,
								onClick: onPower,
								children: enabled ? "⏻ 同步开启" : "⏻ 同步关闭"
							})
						}),
						status !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.status,
							children: status
						}) : null
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.card,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.sub,
							children: "视觉效果 · 即时生效"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
							label: "面板透明度",
							min: 0,
							max: 100,
							value: alpha,
							unit: "%",
							onChange: onAlpha
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
							label: "背景模糊",
							min: 0,
							max: 30,
							value: blur,
							unit: "px",
							onChange: onBlur
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
							label: "阴影深度",
							min: 0,
							max: 100,
							value: shadow,
							unit: "%",
							onChange: onShadow
						})
					]
				})]
			});
		}
		function Slider(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.row,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: props.label }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "range",
						min: props.min,
						max: props.max,
						step: 1,
						value: props.value,
						onChange: (e) => props.onChange(Number(e.target.value))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("output", { children: String(props.value) + props.unit })
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots", "theme"];
		/** 包内单例 store：apply 循环更新，面板组件订阅渲染。 */
		const store = {
			info: null,
			settings: {
				enabled: true,
				panelAlpha: 72,
				blur: 6,
				shadow: 30,
				monitor: ""
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
				const a = .3 + store.settings.panelAlpha / 100 * .6;
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
			function applyBackground() {
				const info = store.info;
				const hasImage = store.settings.enabled && info !== null && info.kind === "image";
				const monitorQuery = store.settings.monitor !== "" ? "&monitor=" + encodeURIComponent(store.settings.monitor) : "";
				const img = hasImage ? "url(\"/we-sync/preview?v=" + info.version + monitorQuery + "\")" : "none";
				const blurPx = Math.round(store.settings.blur);
				const scale = 1 + blurPx / 400;
				const shadowAlpha = store.settings.shadow / 100 * .6;
				styleTag.textContent = "html { background-color: #0d0e12; }body::before { content: \"\"; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -2; background-image: " + img + "; background-size: cover; background-position: center; background-repeat: no-repeat; filter: blur(" + blurPx + "px); transform: scale(" + scale.toFixed(3) + "); transition: filter 0.12s linear; }body::after { content: \"\"; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -1; background: linear-gradient(rgba(6,8,12," + shadowAlpha.toFixed(3) + "), rgba(6,8,12," + (shadowAlpha * .85).toFixed(3) + ")); }";
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
		exports.apply = apply;
		exports.inject = inject;
		exports.store = store;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map