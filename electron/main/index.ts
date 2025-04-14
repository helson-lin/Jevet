import { app, BrowserWindow, shell, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from 'node:fs'
import sharp from "sharp";
import  png2icns from "png2icons";
interface IMG_ITEM {
  buffer: ArrayBuffer;
  uid: string;
}
[];
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, "../..");

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win: BrowserWindow | null = null;
const preload = path.join(__dirname, "../preload/index.mjs");
const indexHtml = path.join(RENDERER_DIST, "index.html");

async function createWindow() {
  win = new BrowserWindow({
    title: "Main window",
    width: 850,
    height: 580,
    icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    // #298
    win.loadURL(VITE_DEV_SERVER_URL);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });
  // win.webContents.on('will-navigate', (event, url) => { }) #344
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: true,
    },
  });
  console.log(`🚀 ${VITE_DEV_SERVER_URL}#/${arg}`)
  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}/#/${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});

ipcMain.handle('moveToDownloads', async (event, tempFilePaths) => {
  try {
    // 支持单文件路径或文件路径数组
    const files = Array.isArray(tempFilePaths) ? tempFilePaths : [tempFilePaths];
    
    const movePromises = files.map(async (filePath) => {
      const downloadsPath = path.join(os.homedir(), 'Downloads', path.basename(filePath));
      await fs.promises.rename(filePath, downloadsPath);
      return downloadsPath;
    });

    const results = await Promise.all(movePromises);
    
    return { 
      success: true, 
      downloadsPaths: results,
      message: `成功移动了${results.length}个文件到下载目录`
    };
  } catch (err) {
    console.error('Failed to move files:', err);
    return { 
      success: false, 
      error: err.message,
      // 返回部分成功的结果
      partialResults: err.partialResults || [] 
    };
  }
});


ipcMain.handle(
  "pi",
  async (
    _,
    arg: {
      imgs: IMG_ITEM[];
      options?: {
        width?: number; // 宽度
        height?: number; // 高度
        resizeOption?: sharp.ResizeOptions;
        keepExif?: boolean; // 是否保留Exif
        exif: sharp.Exif;
        quality: number;
        outputformat:
          | "png"
          | "jpg"
          | "jpeg"
          | "webp"
          | "gif"
          | "jp2"
          | "tiff"
          | "heif"
          | "icns"
          | "ico";
      };
    }
  ) => {
    try {
      console.log('🚀')
      const qualityDisabled = ['gif']
      const imgs = arg.imgs;
      const options = arg.options;
      const processingPromises = imgs.map(async (imgItem) => {

        const tempDir = os.tmpdir();
        let outputPath = path.join(
          tempDir,
          `resized-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}.${options.outputformat}`
        );

        let sharper = sharp(imgItem.buffer);
        if (options?.width || options?.height) {
          const width = options.width || options.height;
          const height = options.width || options.height;
          if (!options.resizeOption) sharper = sharper.resize(width, height);
          else sharper = sharper.resize(width, height, options.resizeOption);
        }
        if (options?.keepExif) {
          sharper = sharper.keepExif();
        }
        if (options?.exif) {
          sharper = sharper.withExif(options.exif);
        }
        if (options.outputformat) {
          const baseOptions = {quality: options.quality || 100}
          switch (options.outputformat) {
            case "png":
              sharper = sharper.png({ ...baseOptions, effort: 6, palette: true });
              break;
            case "webp":
              sharper = sharper.webp({ effort: 6,  ...baseOptions});
              break;
            case "jpeg":
              sharper = sharper.jpeg(baseOptions);
              break;
            case "jp2":
              sharper = sharper.jp2(baseOptions);
              break;
            case "tiff":
              sharper = sharper.tiff(baseOptions);
            case "gif":
              sharper = sharper.gif({ effort: 6 });
              break;
            case "heif":
              sharper = sharper.heif({ ...baseOptions, effort: 6, });
              break;
            case "icns":
                sharper = sharper.resize({
                  width: 1024,
                  height: 1024,
                  fit: 'contain',
                  background: { r: 0, g: 0, b: 0, alpha: 0 },
                })
                .composite([
                  // rx ry是圆角半径
                  {
                      input: Buffer.from(
                          `<svg>
                            <rect x="0" y="0" width="1024" height="1024" rx="250" ry="250" />
                          </svg>`
                      ),
                      blend: 'dest-in',
                  }
                ])      
                .extend({
                  top: 120,
                  bottom: 120,
                  left: 120,
                  right: 120,
                  background: { r: 0, g: 0, b: 0, alpha: 0 },
              })    
              break;
            case 'ico':
              sharper = sharper.resize({
                width: 1024,
                height: 1024,
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 },
              })
              break;
            default:
              break;
          }
        }
        await sharper.toFile(outputPath);

        let imageBuffer;
        if (options.outputformat === 'icns') {
          const iconBuffer = fs.readFileSync(outputPath)
          imageBuffer = png2icns.createICNS(iconBuffer, 1, 0)
          // outputPath重写
          fs.writeFileSync(outputPath, imageBuffer)
        }else if (options.outputformat === 'ico') {
          const iconBuffer = fs.readFileSync(outputPath)
          imageBuffer = png2icns.createICO(iconBuffer, png2icns.BEZIER, 20, true)
          // outputPath重写
          fs.writeFileSync(outputPath, imageBuffer)
        }  else {
          imageBuffer = await sharp(outputPath).toBuffer();
        }

        // 获取文件大小
        const stats = fs.statSync(outputPath);
        const fileSizeInBytes = stats.size;
        return {
          uid: imgItem.uid,
          outputPath,
          fileSize: fileSizeInBytes,
          base64Image: `data:image/${options.outputformat};base64,${imageBuffer.toString(
            "base64"
          )}`,
        };
      });

      const results = await Promise.all(processingPromises);

      return {
        success: true,
        results,
        message: `成功并行处理了${results.length}张图片`,
      };
    } catch (e) {
      console.error("Image processing error:", e);
      return { success: false, error: e.message };
    }
  }
);
