<div align="center">

# 🎨 Jevet

**A completely free and open-source desktop image processing tool**

[![GitHub license](https://img.shields.io/github/license/helson-lin/Jevet)](https://github.com/helson-lin/Jevet/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/helson-lin/Jevet)](https://github.com/helson-lin/Jevet/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/helson-lin/Jevet)](https://github.com/helson-lin/Jevet/network)
[![GitHub issues](https://img.shields.io/github/issues/helson-lin/Jevet)](https://github.com/helson-lin/Jevet/issues)

Built with Electron + Vue + Vite. Supports image transcoding/compression and offline AI background removal (ONNX).

Comes with multiple AI model management and inference optimization options, ready to use out of the box.

[English](README.en.md) | [中文](README.md)

</div>

---

## ⚠️ Important Notice

**Jevet is completely free and open-source. Everyone can use it forever for free.**

- 🚫 Do not pay anyone for this software. If someone charges you, please [report it](https://github.com/helson-lin/Jevet/issues)
- 💝 If you find it helpful, please [Star ⭐ the project](https://github.com/helson-lin/Jevet)
- 🤝 Contributions, bug reports, and feature suggestions are welcome

## ✨ Features

### 🖼️ Image Transcoding / Compression
- **Formats**: PNG, JPG/JPEG, WEBP, GIF, JP2, TIFF, HEIF, ICNS, ICO
- **Custom settings**: Quality, size, keep EXIF
- **Watermark**: Add custom text watermark
- **Batch processing**: Process multiple images at once

### 🎯 Offline AI Background Removal
- **Models**:
  - `rmbg-1.4` - Best overall quality for people, animals, and objects
  - `bria-rmbg-2.0` - Improved over rmbg-1.4, better quality with higher memory usage
  - `u2net` - General-purpose pretrained model, balanced performance and quality
  - `u2net_human_seg` - Optimized for human segmentation
  - `silueta` - Lightweight u2net variant (~43 MB)
  - `isnet-general-use` - Next-generation general-purpose model

- **Smart management**: Auto model download, MD5 verification, versioning
- **Performance**:
  - CPU multi-thread inference optimization
  - Graph Optimization Level tuning
  - Memory usage monitoring and tuning

### 🛠️ User Experience
- **Modern UI**: Vue 3 + Ant Design Vue, light/dark themes
- **i18n**: Chinese/English interface
- **Batch processing**: Parallel processing for multiple images
- **Preview & Export**: Real-time preview and one-click export
- **Settings**: Paths, language, model management, inference options

## 💻 System Requirements

### Operating Systems
| OS | Version | AI Inference | Status |
|----|---------|--------------|--------|
| 🍎 **macOS** | 12+ (Apple Silicon/Intel) | CPU | ✅ Fully supported |
| 🪟 **Windows** | 10+ (x64) | CPU | ✅ Fully supported |
| 🐧 **Linux** | x64 distributions | CPU | ✅ Fully supported |

### Hardware
- **Memory**: 8 GB+ recommended (larger models like bria-rmbg-2.0 require more)
- **Storage**: At least 2 GB free space (for model files)
- **GPU**: CPU inference on all platforms (onnxruntime-node currently does not support GPU acceleration)

### Development Environment
- **Node.js**: 22.x (project uses Volta to pin versions)
- **Package manager**: npm or yarn

## 🚀 Quick Start

### Download (Recommended)
1. Go to the [Releases page](https://github.com/helson-lin/Jevet/releases) and download the installer for your OS
2. Install and launch the app
3. Download the required AI models in Settings → Model Management
4. Start using it!

### Run from Source
```bash
# Clone
git clone https://github.com/helson-lin/Jevet.git
cd Jevet

# Install dependencies
npm install

# Start dev
npm run dev
```

### Build Distributables
```bash
# Production build
npm run app:dist
```
> The build script performs: TypeScript type-check → Vite build → Electron Builder packaging

## 📁 Project Structure

```text
Jevet/
├── electron/                 # Electron main process
│   ├── main/
│   │   ├── ipc/              # IPC handlers
│   │   │   ├── image.ts      # Image processing & AI removal
│   │   │   ├── config/       # Configuration management
│   │   │   └── file.ts       # File operations
│   │   ├── i18n/             # Backend i18n
│   │   └── index.ts          # Main entry
│   └── preload/              # Preload scripts
├── src/                      # Vue renderer
│   ├── pages/                # Feature pages
│   │   ├── ImgRemoveBg.vue   # AI removal page
│   │   ├── ImgProcess.vue    # Transcode/Compress page
│   │   └── Setting.vue       # Settings
│   ├── components/           # Shared components
│   ├── store/                # Pinia store
│   ├── locales/              # Frontend i18n
│   └── router.ts             # Router
├── electron-builder.json5    # Packaging config
├── vite.config.ts            # Vite config
└── package.json              # Dependencies
```

## 📖 User Guide

### 1️⃣ Model Management
1. Open the app and click the Settings icon (bottom-left)
2. In Model Management, choose the AI models you need
3. Click Download; the app will download and verify with MD5 automatically
4. After download, status shows ✅ Downloaded

> Model recommendations:
> - Beginners: `u2net` or `silueta` (small size, fast)
> - Best quality: `rmbg-1.4` (balanced and strong)
> - Power users: `bria-rmbg-2.0` (better quality, higher memory usage)

### 2️⃣ Inference Settings
**Graph Optimization Level**:
- `disabled` - No optimizations (most stable, slower)
- `basic` - Basic optimizations (recommended default)
- `extended` - Faster but may be unstable on some environments
- `all` - Maximum optimizations (may cause compatibility issues)

> Note: CPU inference is used currently. Keeping `basic` is recommended. If you encounter issues, downgrade to `disabled`.

### 3️⃣ AI Background Removal
1. Go to the Background Removal page
2. Drag & drop or click to upload images (batch supported)
3. Select a downloaded AI model
4. Choose output format (PNG recommended for transparency)
5. Click Start
6. Preview the results and Export to save

### 4️⃣ Image Transcoding/Compression
1. Open the Transcode/Compress page
2. Upload images
3. Configure output parameters:
   - **Format**: PNG, JPG, WEBP, etc.
   - **Quality**: 1-100 (higher → better)
   - **Size**: Custom width/height or keep aspect ratio
   - **EXIF**: Keep metadata or not
   - **Watermark**: Optional text watermark
4. Click Start to batch process

## 🛠️ Tech Stack

### Frontend
- Vue 3 + TypeScript
- Vite
- Ant Design Vue
- Pinia
- Vue Router
- Tailwind CSS
- Vue I18n

### Backend
- Electron + Node.js
- Sharp
- ONNX Runtime
- File processing utilities
- Electron IPC

### Tooling
- npm + Volta (version management)
- ESLint + Prettier
- TypeScript
- Electron Builder

## ❓ FAQ

<details>
<summary><strong>Q: Why CPU-only inference? No GPU acceleration?</strong></summary>

**A:** The current version uses `onnxruntime-node`, which does not provide stable GPU backends on desktop:
- No stable CUDA support in onnxruntime-node at the moment
- macOS Metal backend is not supported yet
- For cross-platform stability, CPU inference is used

Future possibilities:
- Wait for official GPU support from onnxruntime-node
- Integrate other inference engines with GPU support
</details>

<details>
<summary><strong>Q: Model download fails or is slow?</strong></summary>

**A:** Try the following:
- Check your network connection
- Switch to a different network (e.g., mobile hotspot)
- Manually download models and place them in the model directory
- Contact the maintainer for mirror links
</details>

<details>
<summary><strong>Q: Out-of-memory errors with large images?</strong></summary>

**A:** Consider:
- Use lighter models (e.g., u2net, silueta)
- Lower Graph Optimization Level to basic or disabled
- Avoid processing too many images in parallel
- Close other memory-heavy applications
</details>

<details>
<summary><strong>Q: Is the app safe? Any data collection?</strong></summary>

**A:** Jevet is fully open-source:
- ✅ All processing is local; no images are uploaded
- ✅ No personal data or usage data is collected
- ✅ Source code is public for audit
- ✅ All AI models run locally
</details>

<details>
<summary><strong>Q: How to report bugs or request features?</strong></summary>

**A:**
- [Open an Issue](https://github.com/helson-lin/Jevet/issues)
- [Join Discussions](https://github.com/helson-lin/Jevet/discussions)
- Send a Pull Request
</details>

## 👨‍💻 Contributing

We welcome all kinds of contributions: code, docs, tests, suggestions, and feedback.

### How to Contribute

1. **Fork** this repository
2. **Clone** your fork locally
3. Create a feature branch: `git checkout -b feature/amazing-feature`
4. Make your changes
5. Commit: `git commit -m 'Add some amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a **Pull Request**

### Contribution Types

- 🐛 Bug fixes
- ✨ New features & improvements
- 📚 Documentation
- 🌐 i18n
- 🧪 Tests
- 🎨 UI/UX

### Dev Environment

```bash
# Clone
git clone https://github.com/helson-lin/Jevet.git
cd Jevet

# Install
npm install

# Start dev server
npm run dev

# Rebuild native modules (if needed)
npm run rebuild

# macOS: reinstall sharp (if needed)
npm run sharp:mac
```

### Code Style

- Use TypeScript
- Follow the existing style
- Add appropriate documentation to new features
- Ensure ESLint passes

## 💝 Support

If Jevet helps you, please consider supporting the project:

- ⭐ Star this repository
- 🍴 Fork and contribute
- 🐛 Report bugs or suggest improvements
- 📢 Spread the word
- 💬 Join [Discussions](https://github.com/helson-lin/Jevet/discussions)

## 📄 License

Released under the [AGPL-3.0](LICENSE). If you modify the software and make it available to users over a network (e.g., as a hosted service), you must offer those users the complete corresponding source code of your version, including your modifications.

## 🙏 Acknowledgements

Thanks to these projects and technologies:

- [Electron](https://electronjs.org/) - Cross-platform desktop framework
- [Vue.js](https://vuejs.org/) - Progressive JavaScript framework
- [ONNX Runtime](https://onnxruntime.ai/) - High-performance inference engine
- [Sharp](https://sharp.pixelplumbing.com/) - High-performance image processing
- [Ant Design Vue](https://antdv.com/) - Enterprise UI components
- [Vite](https://vitejs.dev/) - Next-gen build tool

Special thanks to researchers and developers who contributed to training and optimizing the AI models.

---

<div align="center">

## 🌟 If you find this useful, please give it a Star ⭐

**[⬆ Back to top](#-jevet)**

</div>

---

## 📞 Contact

- **Project Repository**: [github.com/helson-lin/Jevet](https://github.com/helson-lin/Jevet)
- **Issues & Discussions**: [github.com/helson-lin/Jevet/issues](https://github.com/helson-lin/Jevet/issues)
- **Developer**: [@helson-lin](https://github.com/helson-lin)


