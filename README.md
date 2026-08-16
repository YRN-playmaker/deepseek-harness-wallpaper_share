# we-sync-dsh · Wallpaper Engine ↔ DeepSeek Harness 壁纸同步

[中文](#中文) | [English](#english)

---

<a name="中文"></a>
# 中文
- 被网友人身攻击，气出来的产物，糙的不行
把 Wallpaper Engine 当前显示的壁纸实时同步为 DeepSeek Harness Web 界面的背景（磨砂玻璃风格），并支持从页面随机切换壁纸、用滑块调节透明度 / 模糊 / 阴影。

> **无敏感信息**：代码不含 Steam 用户名 / SteamID / 令牌。Wallpaper Engine 安装目录**运行时自动检测**（注册表 `HKCU\Software\WallpaperEngine\installPath` → 常见 Steam 路径），检测不到时才需要手动配置。

## 功能

- **实时同步**：在 Wallpaper Engine 中应用壁纸后，页面背景约 2 秒内自动跟随
- **双向控制**：`wallpaper_share` 标签页内 🎲 随机换一张（`wallpaper64.exe -control openWallpaper -workshop <id>`）
- **视觉效果滑块（即时生效）**：面板透明度 0–100% / 背景模糊 0–30px / 阴影深度 0–100%
- **同步开关** ⏻ 一键启停
- 自诊断路由 `/we-sync/diag`（仅本机可访问）

## 安装（三步，无需 checkout、无需构建）

> 前置：DSH 已用 `dsh --profile web` 启动过至少一次（会自动创建 `~/.dsh/profiles/web/`）。

```bash
# ① 安装包到用户 profile 工作区
cd ~/.dsh/profiles/web && pnpm add https://github.com/YRN-playmaker/deepseek-harness-wallpaper_share
```

```yaml
# ② 编辑 ~/.dsh/profiles/web/cordis.patch.yml
#    默认文件内容是 []，把它替换为：
- insert:
    - id: we-sync
      name: we-sync-dsh
```

```bash
# ③ 重启 dsh（web profile），打开页面即可看到 wallpaper_share 标签页
```

原理：DSH 的 profile 有官方预留的**用户补丁层**（`~/.dsh/profiles/web/cordis.patch.yml`，应用在全部 bundle 层之后）。这一行同时是：
- **host 行**：在宿主组合中挂载 node 半（轮询 + HTTP 路由）；
- **`dsh.client` roster 行**：浏览器半的预构建产物（`lib/client.js`）由模块系统自动扫描并注入页面。

包发布时**自带预构建产物**，用户侧零构建。

## 从源码构建（开发者）

1. 把本仓库 `pkg/` 目录拷入你的 DSH checkout：`packages/client/we-sync/`；
2. `pnpm install`
3. `pnpm --filter we-sync-dsh exec tsc -b`
4. `pnpm --filter we-sync-dsh bundle`
5. 产物在 `packages/client/we-sync/lib/`（`index.js` node 半 + `client.js` 浏览器半）。

## 配置

包源码 `pkg/src/index.ts` 顶部 `CONFIG`：

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

- `pkg/` — 静态插件包源码（node 半 `src/index.ts` + 浏览器半 `src/client/`，含构建配置与预构建产物 `lib/`）
- `we-sync-dsh-0.1.0.tgz` — 发布 tarball（GitHub Release 附件）
- `host.js` / `client.js` — 动态插件形态（DSH 会话内 `cordis_define` 粘贴使用，功能等价）
- `cordis.patch.example.yml` — 用户补丁层示例
- `install.ps1` — 可选的一键安装脚本（自动 pnpm add + 写补丁行）

## 许可证

MIT。

---

<a name="english"></a>
# English

Sync the wallpaper currently displayed by Wallpaper Engine onto the DeepSeek Harness Web UI as a frosted-glass page background, with random wallpaper switching and adjustable transparency / blur / shadow sliders.

> **No sensitive data**: the code contains no Steam username, SteamID, or tokens. The Wallpaper Engine install directory is **auto-detected at runtime** (registry `HKCU\Software\WallpaperEngine\installPath` → common Steam paths); manual configuration is only a fallback.

## Features

- **Live sync**: after applying a wallpaper in Wallpaper Engine, the page background follows within ~2 seconds
- **Two-way control**: 🎲 random wallpaper switch from the `wallpaper_share` tab (`wallpaper64.exe -control openWallpaper -workshop <id>`)
- **Instant visual sliders**: panel transparency 0–100% / background blur 0–30px / shadow depth 0–100%
- **Sync toggle** ⏻ one-click on/off
- Self-diagnostic route `/we-sync/diag` (localhost only)

## Install (3 steps, no checkout, no build)

> Prerequisite: DSH has been started at least once with `dsh --profile web` (it creates `~/.dsh/profiles/web/`).

```bash
# ① Install the package into the user profile workspace
cd ~/.dsh/profiles/web && pnpm add https://github.com/YRN-playmaker/deepseek-harness-wallpaper_share
```

```yaml
# ② Edit ~/.dsh/profiles/web/cordis.patch.yml
#    The default file content is [], replace it with:
- insert:
    - id: we-sync
      name: we-sync-dsh
```

```bash
# ③ Restart dsh (web profile) and open the page — the wallpaper_share tab appears
```

How it works: the DSH profile has an official **user patch layer** (`~/.dsh/profiles/web/cordis.patch.yml`, applied after all bundle layers). The single row is both:
- a **host row**: mounts the node half (polling + HTTP routes) in the host composition;
- a **`dsh.client` roster row**: the prebuilt browser half (`lib/client.js`) is scanned and injected into the page by the module system.

The published package ships **prebuilt artifacts**, so users never build anything.

## Build from source (developers)

1. Copy `pkg/` into your DSH checkout as `packages/client/we-sync/`;
2. `pnpm install`
3. `pnpm --filter we-sync-dsh exec tsc -b`
4. `pnpm --filter we-sync-dsh bundle`
5. Artifacts land in `packages/client/we-sync/lib/` (`index.js` node half + `client.js` browser half).

## Configuration

`CONFIG` at the top of `pkg/src/index.ts`:

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

- `pkg/` — static plugin package source (node half `src/index.ts` + browser half `src/client/`, build config, prebuilt `lib/`)
- `we-sync-dsh-0.1.0.tgz` — release tarball (attach it to GitHub Releases)
- `host.js` / `client.js` — dynamic-plugin form (paste into `cordis_define` inside a DSH session; feature-equivalent)
- `cordis.patch.example.yml` — user patch-layer example
- `install.ps1` — optional one-shot installer (runs pnpm add + writes the patch row)

## License

MIT.
