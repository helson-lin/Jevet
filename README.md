<div align="center">

# 🎨 Jevet

**一款完全免费的开源桌面图片处理工具**

[![GitHub license](https://img.shields.io/github/license/helson-lin/Jevet)](https://github.com/helson-lin/Jevet/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/helson-lin/Jevet)](https://github.com/helson-lin/Jevet/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/helson-lin/Jevet)](https://github.com/helson-lin/Jevet/network)
[![GitHub issues](https://img.shields.io/github/issues/helson-lin/Jevet)](https://github.com/helson-lin/Jevet/issues)

基于 Electron + Vue + Vite 构建，支持图片转码/压缩与离线智能抠图（ONNX）

内置多种AI模型管理与推理优化选项，开箱即用

[English](README.en.md) | [中文](README.md)

</div>

---

## ⚠️ 重要声明

**Jevet 是完全免费的开源软件，任何人都可以永久免费使用！**

- 🚫 **切勿为此软件付费**！如有人向您收费，请立即[举报](https://github.com/helson-lin/Jevet/issues)
- 💝 如果这个软件对您有帮助，欢迎 [Star ⭐](https://github.com/helson-lin/Jevet) 支持项目
- 🤝 欢迎贡献代码、反馈问题或建议功能改进

## ✨ 功能特性

### 🖼️ 图片转码/压缩
- **多格式支持**：PNG、JPG/JPEG、WEBP、GIF、JP2、TIFF、HEIF、ICNS、ICO
- **自定义设置**：质量、尺寸、保留 EXIF 信息
- **水印功能**：添加自定义文本水印
- **批量处理**：一次处理多张图片，提高效率

### 🎯 AI 智能抠图（离线）
- **多模型选择**：
  - `rmbg-1.4` - 综合效果最佳，适用于人物、动物、物体
  - `bria-rmbg-2.0` - rmbg-1.4 升级版，效果更好但内存占用较高
  - `u2net` - 通用场景预训练模型，平衡性能与效果
  - `u2net_human_seg` - 专门针对人体分割优化
  - `silueta` - 轻量版 u2net，体积仅 43MB
  - `isnet-general-use` - 新一代通用场景模型

- **智能管理**：自动模型下载、MD5 校验、版本管理
- **性能优化**：
  - CPU 多线程推理优化
  - 图优化等级调整（Graph Optimization Level）
  - 内存使用监控与优化

### 🛠️ 用户体验
- **现代化界面**：Vue 3 + Ant Design Vue，支持明暗主题
- **国际化支持**：中文/英文界面切换
- **批量处理**：并行处理多张图片
- **预览导出**：实时预览效果，一键导出结果
- **设置管理**：路径配置、语言切换、模型管理、推理设置

## 💻 系统要求

### 操作系统支持
| 系统 | 版本要求 | AI 推理 | 状态 |
|------|----------|---------|------|
| 🍎 **macOS** | 12+ (Apple Silicon/Intel) | CPU | ✅ 完全支持 |
| 🪟 **Windows** | 10+ (x64) | CPU | ✅ 完全支持 |
| 🐧 **Linux** | x64 发行版 | CPU | ✅ 完全支持 |

### 硬件要求
- **内存**：建议 8GB+ （大模型如 bria-rmbg-2.0 需要更多内存）
- **存储**：至少 2GB 可用空间（用于模型文件）
- **显卡**：所有平台均使用 CPU 推理（onnxruntime-node 暂不支持 GPU 加速）

### 开发环境
- **Node.js**：22.x（项目使用 Volta 固定版本）
- **包管理器**：npm 或 yarn

## 🚀 快速开始

### 下载使用（推荐）
1. 前往 [Releases 页面](https://github.com/helson-lin/Jevet/releases) 下载对应系统的安装包
2. 安装并启动应用
3. 在设置中下载所需的 AI 模型
4. 开始使用！

### 从源码运行
```bash
# 克隆项目
git clone https://github.com/helson-lin/Jevet.git
cd Jevet

# 安装依赖
npm install

# 启动开发环境
npm run dev
```

### 构建发布包
```bash
# 构建生产版本
npm run app:dist
```
> 构建脚本会自动执行：TypeScript 类型检查 → Vite 打包 → Electron Builder 打包

## 📁 项目结构

```text
Jevet/
├── electron/                 # Electron 主进程
│   ├── main/
│   │   ├── ipc/             # IPC 通信处理
│   │   │   ├── image.ts     # 图片处理与AI抠图
│   │   │   ├── config/      # 配置管理
│   │   │   └── file.ts      # 文件操作
│   │   ├── i18n/            # 后端国际化
│   │   └── index.ts         # 主进程入口
│   └── preload/             # 预加载脚本
├── src/                     # Vue 渲染进程
│   ├── pages/               # 功能页面
│   │   ├── ImgRemoveBg.vue  # AI抠图页面
│   │   ├── ImgProcess.vue   # 图片处理页面
│   │   └── Setting.vue      # 设置页面
│   ├── components/          # 公共组件
│   ├── store/               # Pinia 状态管理
│   ├── locales/             # 前端国际化
│   └── router.ts            # 路由配置
├── electron-builder.json5   # 打包配置
├── vite.config.ts           # Vite 构建配置
└── package.json             # 项目依赖
```

## 📖 使用指南

### 1️⃣ 模型管理
1. 打开应用，点击左下角 **设置** 图标
2. 在 **模型管理** 区域选择需要的 AI 模型
3. 点击 **下载** 按钮，应用会自动下载并进行 MD5 校验
4. 下载完成后模型状态会显示为 ✅ **已下载**

> **模型选择建议**：
> - 新手用户：推荐 `u2net` 或 `silueta`（体积小，速度快）
> - 追求效果：选择 `rmbg-1.4`（综合效果最佳）
> - 高端用户：尝试 `bria-rmbg-2.0`（效果更好，需要更多内存）

### 2️⃣ 推理配置
**图优化等级**：
- `disabled` - 关闭优化（最稳定，处理速度较慢）
- `basic` - 基础优化（推荐，默认选项，平衡性能与稳定性）
- `extended` - 扩展优化（更快但在某些环境可能不稳定）
- `all` - 全部优化（理论上最快，但可能引起兼容性问题）

> **注意**：当前版本使用 CPU 推理，推荐保持默认的 `basic` 优化等级。如遇到兼容性问题，可降级到 `disabled`。

### 3️⃣ AI 智能抠图
1. 进入 **智能抠图** 页面
2. 拖拽或点击上传图片（支持批量）
3. 选择已下载的 AI 模型
4. 选择输出格式（PNG 推荐，保持透明背景）
5. 点击 **开始处理**
6. 处理完成后可预览效果，点击 **导出** 保存结果

### 4️⃣ 图片转码/压缩
1. 进入 **图片转码压缩** 页面
2. 上传需要处理的图片
3. 设置输出参数：
   - **格式**：PNG、JPG、WEBP 等
   - **质量**：1-100（数值越高质量越好）
   - **尺寸**：自定义宽高或保持原始比例
   - **EXIF**：是否保留图片元信息
   - **水印**：添加文本水印（可选）
4. 点击 **开始处理** 批量转换

## 🛠️ 技术栈

### 前端技术
- **框架**：Vue 3 + TypeScript
- **构建工具**：Vite
- **UI 库**：Ant Design Vue
- **状态管理**：Pinia
- **路由**：Vue Router
- **样式**：Tailwind CSS
- **国际化**：Vue I18n

### 后端技术
- **运行时**：Electron + Node.js
- **图像处理**：Sharp
- **AI 推理**：ONNX Runtime
- **文件处理**：多种格式支持
- **IPC 通信**：Electron IPC

### 开发工具
- **包管理**：npm + Volta（版本管理）
- **代码规范**：ESLint + Prettier
- **类型检查**：TypeScript
- **打包工具**：Electron Builder

## ❓ 常见问题（FAQ）

<details>
<summary><strong>Q: 为什么软件只支持 CPU 推理，不支持 GPU 加速？</strong></summary>

**A:** 当前版本基于 `onnxruntime-node`，该运行时在桌面环境下暂不支持 GPU 加速：
- onnxruntime-node 目前不提供稳定的 CUDA 支持
- macOS 的 Metal 后端也尚未支持
- 为确保跨平台稳定性，统一使用 CPU 推理

未来版本可能会考虑：
- 等待 onnxruntime-node 官方 GPU 支持
- 或集成其他支持 GPU 的推理引擎
</details>

<details>
<summary><strong>Q: 模型下载失败或速度很慢怎么办？</strong></summary>

**A:** 可以尝试以下解决方案：
- 检查网络连接状态
- 更换网络环境（如使用移动热点）
- 手动下载模型文件放到模型目录
- 联系开发者获取备用下载链接
</details>

<details>
<summary><strong>Q: 处理大图片时出现内存不足错误？</strong></summary>

**A:** 建议采取以下措施：
- 选择占用内存较小的模型（如 u2net、silueta）
- 降低图优化等级到 basic 或 disabled
- 避免同时处理过多图片
- 关闭其他占用内存的应用程序
</details>

<details>
<summary><strong>Q: 软件是否安全？会收集用户数据吗？</strong></summary>

**A:** Jevet 是完全开源的软件：
- ✅ 所有图片处理均在本地完成，不上传到服务器
- ✅ 不收集任何用户个人信息或使用数据
- ✅ 源代码完全公开，可以自行审查
- ✅ 所有 AI 模型均为离线运行
</details>

<details>
<summary><strong>Q: 如何报告 Bug 或建议新功能？</strong></summary>

**A:** 欢迎通过以下方式参与项目：
- [提交 Issue](https://github.com/helson-lin/Jevet/issues) 报告问题或建议功能
- [查看讨论区](https://github.com/helson-lin/Jevet/discussions) 参与社区讨论
- 提交 Pull Request 贡献代码
</details>

## 👨‍💻 贡献指南

我们欢迎所有形式的贡献！无论是代码、文档、测试、建议还是反馈。

### 如何贡献

1. **Fork** 此仓库到您的 GitHub 账户
2. **Clone** 您 fork 的仓库到本地
3. 创建新的功能分支：`git checkout -b feature/amazing-feature`
4. 进行您的修改和改进
5. 提交更改：`git commit -m 'Add some amazing feature'`
6. 推送到分支：`git push origin feature/amazing-feature`
7. 创建 **Pull Request**

### 贡献类型

- 🐛 **Bug 修复**：帮助修复已知问题
- ✨ **新功能**：添加新的功能或改进
- 📚 **文档**：改进文档、添加示例
- 🌐 **国际化**：添加新语言支持
- 🧪 **测试**：增加测试覆盖率
- 🎨 **UI/UX**：改进界面设计和用户体验

### 开发环境设置

```bash
# 克隆项目
git clone https://github.com/helson-lin/Jevet.git
cd Jevet

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 重新构建原生模块（如果需要）
npm run rebuild

# macOS 重新安装 sharp（如果需要）
npm run sharp:mac
```

### 代码规范

- 使用 TypeScript 编写代码
- 遵循现有的代码风格
- 为新功能添加适当的注释
- 确保代码通过 ESLint 检查

## 💝 支持项目

如果 Jevet 对您有帮助，请考虑支持项目发展：

- ⭐ **Star** 这个仓库
- 🍴 **Fork** 并贡献代码
- 🐛 报告 **Bug** 或提出改进建议
- 📢 向朋友推荐 **Jevet**
- 💬 参与 [Discussions](https://github.com/helson-lin/Jevet/discussions)

## 📄 许可证

本项目以 [AGPL-3.0](LICENSE) 协议开源。若您修改并通过网络向用户提供本软件（例如作为服务在线提供），需向该网络服务的用户开放对应版本的完整源代码及您的改动。

## 🙏 致谢

感谢以下开源项目和技术的支持：

- [Electron](https://electronjs.org/) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [ONNX Runtime](https://onnxruntime.ai/) - 高性能机器学习推理引擎
- [Sharp](https://sharp.pixelplumbing.com/) - 高性能图像处理库
- [Ant Design Vue](https://antdv.com/) - 企业级 UI 组件库
- [Vite](https://vitejs.dev/) - 下一代前端构建工具

特别感谢所有为 AI 模型训练和优化做出贡献的研究者和开发者。

---

<div align="center">

## 🌟 如果您觉得有帮助，请给个 Star ⭐

**[⬆ 回到顶部](#-jevet)**

</div>

---

## 捐助

![Donate](./spon.jpg)