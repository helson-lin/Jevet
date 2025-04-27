# Jevet

一款基于 Electron + Vue + Vite 的桌面图片工具，支持图片转码/压缩与离线智能抠图（ONNX）。内置多种模型管理与推理优化选项，开箱即用。

## 功能特性

- 图片转码/压缩
  - 支持 PNG / JPG(JPEG) / WEBP / GIF / JP2 / TIFF / HEIF / ICNS / ICO
  - 自定义质量、尺寸，保留 EXIF，可添加文本水印
- 智能抠图（离线）
  - 支持 u2net、rmbg-1.4、bria-rmbg-2.0、isnet-general-use、BEN2 等模型
  - 自动模型校验（MD5）、下载与目录管理
  - 推理配置：GPU 加速（CUDA）与图优化等级（Graph Optimization Level）
- 批量处理与预览导出
- 友好的设置页：路径/语言/主题/模型管理/推理配置

## 系统要求

- 操作系统：
  - macOS 12+（Apple Silicon/Intel）：当前使用 CPU 推理（onnxruntime-node 暂无 Metal）
  - Windows 10+/Linux x64：支持 CPU 或 CUDA（可选）
- 运行环境：Node.js 22（项目使用 Volta 固定版本）、npm
- CUDA（可选，仅 Win/Linux）：安装匹配版本的 NVIDIA 驱动、CUDA 与 cuDNN 后可启用 GPU 推理

## 快速开始

```bash
npm install
npm run dev
```

构建发布：

```bash
npm run app:dist
```

构建脚本会执行类型检查、Vite 打包与 electron-builder 打包。

## 目录概览

```text
electron/           # 主进程与预加载脚本
  main/
    ipc/            # 各类 IPC 处理器（图片处理/抠图/配置/文件等）
src/                # 渲染进程（Vue 应用）
  pages/            # 功能页面（抠图、设置等）
  store/            # Pinia 全局状态
  locales/          # 多语言
electron-builder.json5   # 打包配置（asarUnpack、extraResources 等）
vite.config.ts           # Vite & Electron 打包
```

## 使用说明

1) 模型管理
- 进入“设置 -> 模型管理”，选择并下载需要的模型；或自定义模型目录。
- 应用会自动对模型文件做 MD5 校验并标记“已下载”。

2) 推理配置（GPU/图优化）
- 进入“设置 -> 推理配置”：
  - 使用 GPU 加速：在 Windows/Linux 上可启用 CUDA，未满足依赖会自动回退 CPU。
  - 图优化等级（Graph Optimization Level）：`disabled` / `basic` / `extended` / `all`。
    - 默认：`basic`。更高等级可能更快，但在部分环境会引入不稳定。

3) 智能抠图
- 前往“移除背景”页面，选择已下载模型与输出格式，点击开始处理。
- 结果支持预览与导出；批量处理时会并行执行。

4) 图片转码/压缩
- 在“图片转码压缩”中设置目标格式、质量、尺寸、是否保留 EXIF、是否添加水印后即可批量处理。

## 模型与兼容性提示

- bria-rmbg-2.0 效果好但显存/内存占用高，建议在资源较充足的机器上使用。
- u2net 家族（含 silueta、u2net_human_seg）占用更低，速度较快。
- isnet-general-use、BEN2 适合更高精度/分辨率场景（占用更高）。

## 常见问题（FAQ）

- onnxruntime-node 报错 “graphOptimizationLevel must be a string”
  - 已在主进程中确保传入字符串枚举，请使用设置页选择对应等级。

- 运行日志出现 “MergeShapeInfo … Falling back to lenient merge”
  - 为 ONNX 形状合并警告，通常不影响结果，可忽略。

- sharp 报错 “vips_colourspace: no known route from 'srgb' to 'rgb'”
  - 已统一使用 `toColorspace('srgb')`，并以原始通道数据（raw）读取。

- 打包后找不到 onnxruntime 原生绑定
  - 本项目已在 `electron-builder.json5` 配置 `asarUnpack` 与 `extraResources`，并在生产构建将 `onnxruntime-node` 标记为 external（详见 `vite.config.ts`）。若仍有问题，请确认平台架构与依赖匹配。

- CUDA 未生效
  - 需要系统已安装 NVIDIA 驱动、CUDA 与 cuDNN 且版本与 `onnxruntime-node` 匹配。否则会自动回退 CPU。

## 开发与构建说明

- 原生依赖
  - 使用了 `sharp`、`png2icons`、`onnxruntime-node` 等原生模块。
  - 打包时通过 `asarUnpack`/`extraResources` 确保原生文件可被加载。

- 开发命令
  - 重新构建原生模块：
    ```bash
    npm run rebuild
    ```
  - 针对 macOS 重装 sharp（如需）：
    ```bash
    npm run sharp:mac
    ```

## 许可证

MIT

