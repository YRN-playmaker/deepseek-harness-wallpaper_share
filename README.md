# we-sync-dsh · Wallpaper Engine ↔ DeepSeek Harness 壁纸同步

[中文](#中文) | [English](#english)

---

<a name="中文"></a>
# 中文
- 被网友人身攻击，气出来的产物，糙的不行
- 把 Wallpaper Engine 当前显示的壁纸实时同步为 DeepSeek Harness Web 界面的背景（磨砂玻璃风格），并支持从页面随机切换壁纸、用滑块调节透明度 / 模糊 / 阴影。

> **无敏感信息**：代码不含 Steam 用户名 / SteamID / 令牌。Wallpaper Engine 安装目录**运行时自动检测**（注册表 `HKCU\Software\WallpaperEngine\installPath` → 常见 Steam 路径），检测不到时才需要手动配置。

## 功能

- **实时同步**：在 Wallpaper Engine 中应用壁纸后，页面背景约 2 秒内自动跟随
- **纯显示同步**：只读取 WE 状态，不控制 / 不修改桌面壁纸（换壁纸请在 WE 内操作）
- **多显示器**：自动跟随"最近变化"的一台；复数显示器时可手动锁定某台作为背景来源
- **视觉效果滑块（即时生效）**：面板透明度 0–100% / 背景模糊 0–30px / 阴影深度 0–100%
- **渲染模式切换**：性能（静态预览图，默认）⇄ 增强（加载壁纸源文件——视频壁纸直接播放原视频、Web 壁纸加载原页面；场景/应用壁纸自动回退预览）
- **专注模式 🎯**：开启后锁定滑块，任务进行中自动切换为 30% / 15px / 90%，任务完成后自动切换为 9% / 6px / 40%
- **同步开关** ⏻ 一键启停
- 自诊断路由 `/we-sync/diag`（仅本机可访问）

## 安装（官方 dsh plugin 通道，零手工配置）

> 前置：DSH 已用 `dsh --profile web` 启动过至少一次。

```bash
# 任选其一：
dsh plugin --profile web add github:YRN-playmaker/dsh-wallpaper_share
#   从 GitHub 安装（仓库自带预构建 lib/，不需要构建许可）
dsh plugin --profile web add we-sync-dsh
#   从 npm 安装（发布后）
dsh plugin --profile web add ./we-sync-dsh-0.1.0.tgz
#   本地 tarball 安装
```

```bash
# 重启 dsh（web profile），打开页面即可看到 wallpaper_share 标签页
```

**无需手动编辑任何配置文件**：包内 `dsh.bundle.patch` 指向的 `cordis.patch.yml` 会在安装时自动加入 profile 的 bundle 层，其中一行同时是 host 行（node 半：轮询 + HTTP 路由）和 `dsh.client` roster 行（浏览器半的预构建 `lib/client.js` 由模块系统自动注入页面）。包发布时**自带预构建产物**，用户侧零构建。

## 从源码构建（开发者）

1. 把本仓库根目录（`package.json`/`src/`/`tsconfig.json`/`tsdown.config.ts`）拷入你的 DSH checkout：`packages/client/we-sync/`；
2. `pnpm install`
3. `pnpm --filter we-sync-dsh exec tsc -b`
4. `pnpm --filter we-sync-dsh bundle`
5. 产物在 `packages/client/we-sync/lib/`（`index.js` node 半 + `client.js` 浏览器半），拷回本仓库 `lib/` 后 `pnpm pack` 出新 tarball。

## 配置

包源码 `src/index.ts` 顶部 `CONFIG`：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `wallpaperEngineDir` | `''`（自动检测） | 检测失败时手动指定安装目录 |
| `workshopContentDir` | `''`（自动推导） | 工作坊内容目录 |
| `pollIntervalMs` | `2000` | 轮询间隔 |
| `previewMaxBytes` | `6291456` | 预览图大小上限 |

## 排查

- `http://127.0.0.1:3080/we-sync/diag`：内部状态（`kind` / `fingerprint` / `weDir` / `lastError`）；
- `lastError` 提示未找到安装目录 → 在包源码 `CONFIG.wallpaperEngineDir` 手动指定后重新构建 / 重新安装；
- 页面没变化 → 刷新页面，确认标签栏出现 `wallpaper_share`。

## 已知限制

- 页面背景使用静态预览图（`.gif` 会自动动）；视频 / 场景壁纸的原画面未接入；
- 多显示器时取 `lastselectedmonitor`（无则第一台）；
- 视觉参数仅保存在页面内存，刷新回到默认值（72% / 6px / 30%）。


## 目录

- `package.json` — 包清单：`dsh.bundle.patch` → `cordis.patch.yml`，`dsh.client` → 浏览器半，`exports["./client"]` → 预构建 `lib/client.js`
- `cordis.patch.yml` — bundle 补丁层（host 行 + dsh.client roster 行）
- `src/index.ts` — node 半源码（轮询 / HTTP 路由）
- `src/client/` — 浏览器半源码（主题覆盖 / 背景层 / wallpaper_share 面板）
- `lib/` — 预构建产物（用户零构建；GitHub 安装也无需构建许可）
- `we-sync-dsh-0.1.0.tgz` — 发布 tarball（GitHub Release 附件）
- `host.js` / `client.js` — 动态插件形态（DSH 会话内 `cordis_define` 粘贴使用，功能等价）
- `install.ps1` — 可选的一键安装脚本（走官方 `dsh plugin add` 通道）

## 许可证

MIT。

---

<a name="english"></a>
# English

Sync the wallpaper currently displayed by Wallpaper Engine onto the DeepSeek Harness Web UI as a frosted-glass page background (display-only), with monitor selection and adjustable transparency / blur / shadow sliders.

> **No sensitive data**: the code contains no Steam username, SteamID, or tokens. The Wallpaper Engine install directory is **auto-detected at runtime** (registry `HKCU\Software\WallpaperEngine\installPath` → common Steam paths); manual configuration is only a fallback.

## Features

- **Live sync**: after applying a wallpaper in Wallpaper Engine, the page background follows within ~2 seconds
- **Display-only**: reads WE state only — never controls or changes your desktop wallpaper (switch wallpapers inside WE)
- **Multi-monitor**: follows the "most recently changed" monitor automatically; with several monitors you can lock one as the background source
- **Instant visual sliders**: panel transparency 0–100% / background blur 0–30px / shadow depth 0–100%
- **Render-mode toggle**: Performance (static preview, default) ⇄ Enhanced (loads the wallpaper source — video wallpapers play the actual video, web wallpapers load the real page; scene/application wallpapers fall back to the preview)
- **Focus mode 🎯**: locks the sliders and auto-switches to 30% / 15px / 90% while a task is running, then to 9% / 6px / 40% when all tasks finish
- **Sync toggle** ⏻ one-click on/off
- Self-diagnostic route `/we-sync/diag` (localhost only)

## Install (official `dsh plugin` flow, zero manual config)

> Prerequisite: DSH has been started at least once with `dsh --profile web`.

```bash
# Pick one:
dsh plugin --profile web add github:YRN-playmaker/dsh-wallpaper_share
#   install from GitHub (the repo ships prebuilt lib/, no build allowance needed)
dsh plugin --profile web add we-sync-dsh
#   install from npm (once published)
dsh plugin --profile web add ./we-sync-dsh-0.1.0.tgz
#   install from the local tarball
```

```bash
# Restart dsh (web profile) and open the page — the wallpaper_share tab appears
```

**No config files to edit by hand**: the `cordis.patch.yml` referenced by `dsh.bundle.patch` is added to the profile's bundle layers automatically on install. Its single row is both a host row (node half: polling + HTTP routes) and a `dsh.client` roster row (the prebuilt browser half `lib/client.js` is injected into the page by the module system). The published package ships **prebuilt artifacts**, so users never build anything.

## Build from source (developers)

1. Copy the repo root (`package.json` / `src/` / `tsconfig.json` / `tsdown.config.ts`) into your DSH checkout as `packages/client/we-sync/`;
2. `pnpm install`
3. `pnpm --filter we-sync-dsh exec tsc -b`
4. `pnpm --filter we-sync-dsh bundle`
5. Artifacts land in `packages/client/we-sync/lib/` (`index.js` node half + `client.js` browser half); copy them back to the repo `lib/` and run `pnpm pack` for a new tarball.

## Configuration

`CONFIG` at the top of `src/index.ts`:

| Key | Default | Meaning |
| --- | --- | --- |
| `wallpaperEngineDir` | `''` (auto-detect) | Manual install dir when detection fails |
| `workshopContentDir` | `''` (auto-derived) | Workshop content directory |
| `pollIntervalMs` | `2000` | Polling interval |
| `previewMaxBytes` | `6291456` | Preview size cap |

## Troubleshooting

- `http://127.0.0.1:3080/we-sync/diag`: internal state (`kind` / `fingerprint` / `weDir` / `lastError`);
- `lastError` says the install dir was not found → set `CONFIG.wallpaperEngineDir` manually and rebuild / reinstall;
- Nothing changes on the page → refresh, and confirm the `wallpaper_share` tab exists.

## Known limitations

- The page background uses the static preview image (`.gif` animates); the actual video/scene wallpaper footage is not hooked up;
- Multi-monitor setups use `lastselectedmonitor` (or the first monitor);
- Visual settings live in page memory only and reset on refresh (72% / 6px / 30%).


## Contents

- `package.json` — manifest: `dsh.bundle.patch` → `cordis.patch.yml`, `dsh.client` → browser half, `exports["./client"]` → prebuilt `lib/client.js`
- `cordis.patch.yml` — the bundle patch layer (host row + dsh.client roster row)
- `src/index.ts` — node half source (polling / HTTP routes)
- `src/client/` — browser half source (theme overrides / background layers / wallpaper_share panel)
- `lib/` — prebuilt artifacts (zero build for users; GitHub installs need no build allowance)
- `we-sync-dsh-0.1.0.tgz` — release tarball (attach it to GitHub Releases)
- `host.js` / `client.js` — dynamic-plugin form (paste into `cordis_define` inside a DSH session; feature-equivalent)
- `install.ps1` — optional one-shot installer (uses the official `dsh plugin add` flow)

## License

MIT.
