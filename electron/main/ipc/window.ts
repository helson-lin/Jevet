import { BrowserWindow, ipcMain, shell } from 'electron';
import { VITE_DEV_SERVER_URL } from '../config';

export function setupWindowHandlers(preload: string, indexHtml: string) {
  ipcMain.handle("open-win", (_, arg) => {
    const childWindow = new BrowserWindow({
      webPreferences: {
        preload,
        nodeIntegration: true,
        contextIsolation: true,
        webSecurity: false,  // 允许加载本地资源
      },
      width: 800,
      height: 600
    });
    
    if (VITE_DEV_SERVER_URL) {
      childWindow.loadURL(`${VITE_DEV_SERVER_URL}/#/${arg}`);
    } else {
      childWindow.loadFile(indexHtml, { hash: arg });
    }
  });

  // 添加关闭窗口的处理程序
  ipcMain.handle("close-win", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.close();
    }
  });

  // 添加打开外部链接的处理程序
  ipcMain.handle("open-external-url", async (_, url: string) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      await shell.openExternal(url);
    }
  });
} 