# Changelog

## [0.2.0] - 2026-08-16

### Renamed

- 插件名由 `we-sync-dsh` 改为 `dsh-wallpaper_share`，与 GitHub 仓库名（`YRN-playmaker/dsh-wallpaper_share`）保持一致（`package.json` / `cordis.patch.yml` / 模块加载器 id / LICENSE / 安装脚本 / README）。
- The package was renamed from `we-sync-dsh` to `dsh-wallpaper_share` to match the GitHub repository name.

### Fixed

- **启动崩溃**：`execFileSync` 原先从 `node:fs` 导入（实际属于 `node:child_process`），ESM 实例化时直接抛 `SyntaxError`，导致整个 web profile 插件树加载失败。现拆分为两个独立 import。
  - `execFileSync` was imported from `node:fs` instead of `node:child_process`, crashing the web profile plugin tree at ESM instantiation. Split into two correct imports.
- **scene 壁纸增强模式黑屏**：回退逻辑要求 `sourceKind === ''` 才显示预览，scene 的 `sourceKind='scene'`（非空）既不显示预览也不走 video/web 分支，被 `setMedia(null)` 清空 → 纯黑屏。
  - Enhanced mode rendered a black screen for scene wallpapers: the fallback only showed the preview when `sourceKind === ''`, but scene reports a non-empty kind.
- **image 壁纸增强模式黑屏**：增强模式下 image 源未接入，同样落入空媒体分支。
  - Enhanced mode also black-screened image wallpapers for the same reason.

### Added

- **scene 纹理提取**：新增 `scanPkgImage()` 扫描 `scene.pkg`（WE 私有 PKGV 容器）内嵌 JPEG/PNG 纹理的 mipmap 链，取最大一张；新增 `/we-sync/scene` 路由用字节切片流式返回。
  - Added `scanPkgImage()` to scan the embedded JPEG/PNG mipmap chain inside `scene.pkg` and a `/we-sync/scene` route that streams the extracted texture by byte slice.
- **HTTP Range 支持**：`serveFile` 新增 `parseRange()` / `serveSlice()`，支持 `Accept-Ranges`、206 Partial Content（`Content-Range` / `Content-Length`）、416 越界、200 全量；视频（尤其 moov 在文件尾的 mp4）可正常 seek。
  - Added HTTP Range support (`parseRange()` / `serveSlice()`) so videos (especially mp4 with moov at the end) can seek normally.
- **自诊断增强**：`/we-sync/diag` 与 `/we-sync/state` 现在返回 scene 纹理提取结果（`sceneImage` 的尺寸 / MIME / 是否可用）。
  - `/we-sync/diag` and `/we-sync/state` now report scene-texture extraction results.

### Compatibility matrix (enhanced mode)

| Wallpaper type | Enhanced-mode behavior |
| --- | --- |
| `video` | plays the source video (Range supported) |
| `web` | loads the source page in an iframe |
| `image` | shows the source image |
| `scene` | shows the extracted pkg texture (falls back to preview only on extraction failure) |
| `application` / `other` | falls back to the static preview |

## [0.1.0] - 2026-08-16

- 首个发布版本（原名 `we-sync-dsh`）：实时同步、多显示器、视觉滑块、专注模式、渲染模式（性能/增强 video+web）、同步开关。
- Initial release (as `we-sync-dsh`): live sync, multi-monitor, visual sliders, focus mode, render-mode toggle, sync toggle.
