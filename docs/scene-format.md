# Wallpaper Engine 场景（scene）壁纸格式调研

> 本文记录对 Wallpaper Engine 场景壁纸文件格式的逆向调研结论，以及"能否在浏览器里完美同步场景壁纸"的可行性判断。样本来自本机 workshop 目录（`.../workshop/content/431960/*`）。

## 1. 壁纸类型与文件

`project.json` 的 `type` 字段区分类型：`video` / `web` / `scene` / `application`。一个典型 scene 壁纸目录：

```
<workshop>/<id>/
├── project.json     # 元数据：title / type / tags / preview / contentrating / general.properties
├── scene.pkg        # 编译后的场景容器（PKGV0001）
├── preview.jpg      # WE 生成的"渲染后截图"缩略图（部分场景是 preview.gif 动画）
└── shaders/         # 编译后的着色器
```

`project.json` 示例（已脱敏）：

```json
{
  "contentrating": "Everyone",
  "file": "scene.json",
  "preview": "preview.jpg",
  "tags": ["Pixel art"],
  "title": "8bit river",
  "type": "scene",
  "visibility": "public"
}
```

## 2. scene.pkg —— PKGV0001 容器

`scene.pkg` 头部魔数（十六进制）：

```
08 00 00 00 | 50 4B 47 56 30 30 30 31 | 04 00 00 00 | ...
   magic_len=8     "PKGV0001"              version=4
```

即：4 字节长度前缀 + `"PKGV0001"` 魔数 + 4 字节版本号，随后是一系列**命名条目**（`name_len` + `name` + `size` + `data`）。第一条目通常是 `scene.json`——编译后的场景图。

`scene.json` 里可以看到场景是一个**实时 3D 场景**：

```json
{
  "camera": { "center": "...", "eye": "...", "up": "..." },
  "general": { "ambientcolor": "...", "bloom": false, "clearcolor": "...", "orthogonalprojection": {...} },
  "objects": [
    { "id": 12, "image": "models/a1041uuu_02.json", "name": "a1041uuu_02",
      "origin": "...", "angles": "...", "copybackground": true, "parallaxDepth": "1.0 ..." }
  ]
}
```

条目里引用了 `models/*.json`（3D 模型）和 `materials/*.tex`（WE 私有 TEX 纹理，含 mipmap 链）。容器的完整二进制格式与开源工具一致：

- [PetYin/WallpaperRepack](https://github.com/PetYin/WallpaperRepack) — PKGV0001 重打包工具
- [redpfire/we](https://github.com/redpfire/we) — PKGV0001 重打包工具
- [notscuffed/repkg](https://github.com/notscuffed/repkg) — PKG/TEX 提取器
- [Almamu/linux-wallpaperengine](https://github.com/Almamu/linux-wallpaperengine) — WE 的 Linux 重实现，含完整格式文档

## 3. 为什么浏览器无法"完美同步"场景壁纸

场景壁纸的真实画面由 **WE 引擎实时渲染**：一个带相机（camera）、3D 模型（models）、材质/着色器（materials + shaders）、粒子系统的 3D 场景。浏览器无法执行这套渲染管线，因此：

- `scene.pkg` 里提取出来的**纹理只是某块材质贴图**（例如某个模型的漫反射贴图），不是最终渲染画面——这正是"提取出的高清纹理 ≠ 壁纸真实效果"的根本原因。
- 要复现真实画面，唯一可行的是渲染整个 3D 场景（相机 + 模型 + 着色器），这在浏览器/Node 半里不现实。

## 4. 最接近"真实效果"的可行方案

| 方案 | 忠实度 | 可行性 |
| --- | --- | --- |
| `preview.jpg` / `preview.gif`（WE 生成的渲染截图/动画） | 高（官方截图，含相机视角与合成结果） | ✅ 已支持（性能模式） |
| 提取 pkg 内单张材质纹理（当前 `scanPkgImage`） | 低（是原始贴图，非合成画面） | ✅ 已实现 |
| 浏览器内渲染 3D 场景（相机 + 模型 + 着色器） | 100% | ❌ 不现实 |

**结论**：对 scene 壁纸，最忠实的同步是直接使用 WE 自带的 `preview.jpg`/`preview.gif`（渲染后的官方截图，部分场景的 gif 还能保留动效）；从 pkg 里提取纹理只是一种"高清但不忠实"的近似，不应作为 scene 的默认增强表现。

## 5. 可落地的后续改进（可选）

1. scene 增强模式默认回退到 `preview`（忠实），把 pkg 纹理提取降级为可选项/回退项；
2. 用 PKGV0001 入口表替代魔数扫描，可靠地提取指定材质/背景纹理；
3. 从 `project.json` / `scene.json` 读取 `tags`、`author`、`schemecolor` 等元数据，丰富面板展示。
