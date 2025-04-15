import { BrowserWindow, ipcMain } from 'electron';
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
} 