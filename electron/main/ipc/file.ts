import { ipcMain } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export function setupFileHandlers() {
  ipcMain.handle('moveToDownloads', async (event, tempFilePaths) => {
    try {
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
        partialResults: err.partialResults || [] 
      };
    }
  });
} 