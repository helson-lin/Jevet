import { app, BrowserWindow, shell, nativeTheme } from "electron";
import path from "node:path";
import os from "node:os";
import fs from 'node:fs';
import { VITE_DEV_SERVER_URL, PUBLIC_DIR, RENDERER_DIST, __dirname } from "./config";
import { setupWindowHandlers } from "./ipc/window";
import { setupFileHandlers } from "./ipc/file";
import { setupImageHandlers } from "./ipc/image";
import { setupConfig, setupNativeTheme } from './ipc/config/index'

// Fix native module path for Windows (both dev and production)
if (process.platform === "win32") {
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  
  // Try multiple possible paths for onnxruntime-node
  const possiblePaths = [];
  
  if (isDev) {
    // Development paths
    possiblePaths.push(
      path.join(process.cwd(), 'node_modules/onnxruntime-node/bin/napi-v3/win32/x64/onnxruntime_binding.node'),
      path.join(__dirname, '../../node_modules/onnxruntime-node/bin/napi-v3/win32/x64/onnxruntime_binding.node')
    );
  } else {
    // Production paths
    const appPath = path.dirname(app.getPath('exe'));
    possiblePaths.push(
      path.join(appPath, 'onnxruntime_binding.node'),
      path.join(appPath, 'resources/onnxruntime_binding.node'),
      path.join(appPath, 'resources/node_modules/onnxruntime-node/bin/napi-v3/win32/x64/onnxruntime_binding.node')
    );
  }
  
  // Find the first existing path
  let nativePath = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      nativePath = possiblePath;
      console.log('Found onnxruntime native module at:', nativePath);
      break;
    }
  }
  
  if (nativePath) {
    // Set environment variable to help onnxruntime-node find the native module
    process.env.ONNXRUNTIME_NODE_BINDING_PATH = nativePath;
    // Also try setting the binary path
    process.env.ORT_BINARY_PATH = path.dirname(nativePath);
  } else {
    console.warn('onnxruntime native module not found in any of the expected paths:', possiblePaths);
  }
}

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
    width: 900,
    height: 670,
    icon: path.join(PUBLIC_DIR, "favicon.ico"),
    webPreferences: {
      preload,
      webSecurity: false,
    },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f1f1f' : '#ffffff',
    titleBarStyle: 'default',
    vibrancy: 'under-window',
    visualEffectState: 'active',
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // 监听系统主题变化
  nativeTheme.on('updated', () => {
    if (win) {
      win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1f1f1f' : '#ffffff');
    }
  });
}

app.whenReady().then(() => {
  const configPath = setupConfig();
  // 设置原生主题
  setupNativeTheme();

  createWindow();

  // 设置所有 IPC 处理程序
  setupWindowHandlers(preload, indexHtml);
  setupFileHandlers();
  setupImageHandlers();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
