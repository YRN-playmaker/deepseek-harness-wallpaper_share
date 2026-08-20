# Scene 增强：Fallback 链实现说明

> 本文说明 `scene` 壁纸增强模式的完整回退链与各层实现，README 只保留摘要。

## 完整 fallback 链

```
真实 Scene Renderer → 浏览器子集渲染器 → 提取的 pkg 纹理 → preview 预览 → 通用纯色背景
```

增强模式逐层尝试，某一层不可用 / 失败时自动回退到下一层。

## 各层实现

### 1. 真实 Scene Renderer（外部进程）

- 配置：`CONFIG.sceneRendererPath`（可执行文件）；`wallpaperEngineAssetsDir` 自动推导为 `<weDir>/assets`，缺失时 renderer 不可用。
- 协议：`tools/scene-renderer/` 定义了协议契约（WebSocket 帧流 + capabilities/status 握手）；内置参考 renderer 是协议实现之一（诊断动画，非真实渲染）。
- 输出：`sceneRenderWidth/Height/Fps/Quality` 控制帧流；真 renderer 建议 JPEG/WebP 输出降带宽。
- 回退条件：renderer 未配置 / 启动失败 / 崩溃 / 无 assets 目录 → 回退浏览器子集渲染器（或按 `sceneRenderMode` 直接跳过）。

### 2. 浏览器子集渲染器（默认）

- `sceneRenderMode: 'auto'`（默认）= 浏览器子集渲染器为主，仅当显式配置 `sceneRendererPath` 才走外部 renderer；`'browser'` 强制浏览器渲染；`'external'` 强制外部 renderer（未配置时用内置参考 renderer 诊断动画）。
- 渲染内容（`src/client/SceneModelRenderer.ts` / `SceneCanvas.ts`）：
  - **图层树 + transform**：解析 `scene.json` 图层树（origin/angles/scale/visible/alpha/parent/attachment），合成进 canvas（WE 场景坐标 y 向上，顶层 y 镜像）。
  - **纹理（Phase 2a，已完成）**：`.tex` 容器格式已实测破解——多数纹理的像素数据是**完整全分辨率 PNG/JPEG**（含 mip 链）；raw 纹理为 **LZ4 压缩 + DXT1/3/5/RGBA8888**（每级 mip 带 [W][H][LZ4][解压尺寸][压缩尺寸] 头）；R8/RG88 解码为 alpha 通道（雾等灰度纹理）。格式细节见 `docs/tex-format-findings.md`。
  - **粒子（Phase C，进行中）**：解析 WE `particles/*.json` 预设（发射器/初始化器/算子/渲染器/材质，含 instanceoverride 覆盖）；材质 `blending` 字段驱动混合模式（translucent → alpha 混合，additive → 叠加）；rate 单位 = 每秒粒子数。
  - **puppet（精细化绑定，进行中）**：`_puppet.mdl` 逆向——80B 顶点（pos/4 骨骼权重/uv）、MDLS 骨骼定义表（parent 链 + bind 矩阵）、MDAT 具名骨骼（attachment 锚点）、MDLE 姿势矩阵、MDLA 动画（装配根呼吸 + 部件摆动；静态姿势表自动跳过）。
  - 未解码 / 无纹理图层以占位标记显示。
- 回退条件：浏览器渲染失败（如模型解析失败）→ 回退 pkg 纹理提取。

### 3. 提取的 pkg 纹理

- `PKGV0001` 条目表解析 + `.tex` 解码（内嵌 PNG/JPEG 或 LZ4+DXT）→ `/we-sync/scene/texture` 路由按文件区间伺服。
- 回退条件：提取失败 → 回退 preview 预览。

### 4. preview 预览（性能模式 / 兜底）

- 壁纸项目自带的预览图（`preview.gif/jpg`），cover 铺满画布。
- 性能模式的默认显示。

### 5. 通用纯色背景

- `scene.json` 的 `clearColor`（0-1 浮点，>1 视为 0-255）。

## 状态与后续

- Phase 2a 纹理：完成（真实图层贴图）。
- Phase C 粒子：完成主体（Fog/Ember/雪花），shader effect / SceneScript / keyframe 动画为后续。
- puppet：stride=80 网格 / 骨骼 / attachment / 呼吸 + 部件摆动动画已完成；蒙皮（骨骼矩阵 × bind⁻¹ × 顶点）待真实部件逐帧动画样本验证。
- 诊断：`/we-sync/diag` 路由展示 scene renderer capabilities / status / fallback 层与纹理提取结果。
