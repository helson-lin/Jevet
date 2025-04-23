import { ipcMain, dialog, OpenDialogOptions, BrowserWindow } from 'electron';
import path from 'node:path';
import https from 'https';
import os from 'node:os';
import fs from 'node:fs';
import { AppOptions, getConfig, updateConfig } from './config';

// 文件处理
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
  // 获取配置文件
  ipcMain.handle('getConfig', getConfig)
  // 选择目录
  ipcMain.handle('select-directory', async (_, options: OpenDialogOptions) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: options?.title || '选择目录',
      buttonLabel: options?.buttonLabel || '选择此文件夹'
    });
    
    // 如果用户取消了选择，返回空字符串
    if (result.canceled) {
      return {
        success: false,
        data: null
      };
    }
    
    return {
      success: Boolean(result.filePaths?.[0]),
      data: result.filePaths?.[0]
    };
  })
  ipcMain.handle('updateConfig', async (_, options: Partial<AppOptions>) => updateConfig(options))
  // 下载模型
  ipcMain.handle('dowloadModel', async (event, { url, fileName, modelId }) => {

    try {
      // 获取配置信息
      const configResult = getConfig();
      if (!configResult.success || !configResult.data) {
        throw new Error('无法获取配置信息');
      }
      
      const config = configResult.data;
      const modelDir = config.modelDir;
      
      if (!modelDir) {
        throw new Error('模型目录未配置');
      }
      
      // 确保模型目录存在
      if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
      }
      
      const filePath = path.join(modelDir, fileName);
      const file = fs.createWriteStream(filePath);
      
      // 获取当前窗口以发送进度更新
      const win = BrowserWindow.getFocusedWindow();
      if (!win) {
        throw new Error('找不到活动窗口');
      }
      
      return new Promise((resolve, reject) => {
        let receivedBytes = 0;
        let totalBytes = 0;
        
        const req = https.get(url, (response) => {
          // 检查响应状态码
          if (response.statusCode !== 200) {
            reject(new Error(`下载失败，状态码: ${response.statusCode}`));
            return;
          }
          
          totalBytes = parseInt(response.headers['content-length'] || '0', 10);
          
          response.on('data', (chunk) => {
            receivedBytes += chunk.length;
            
            // 计算下载进度
            const progress = totalBytes ? Math.round((receivedBytes / totalBytes) * 100) : 0;
            
            // 发送进度更新到渲染进程
            win.webContents.send('download-progress', {
              modelId,
              progress,
              received: receivedBytes,
              total: totalBytes
            });
          });
          
          response.pipe(file);
          
          file.on('finish', () => {
            file.close();
            
            // 更新配置中的模型状态
            if (config.models && Array.isArray(config.models)) {
              const modelIndex = config.models.findIndex(m => m.id === modelId);
              if (modelIndex !== -1) {
                config.models[modelIndex].downloaded = true;
                config.models[modelIndex].path = fileName;
                
                // 保存更新后的配置
                fs.writeFileSync(configResult.path, JSON.stringify(config, null, 2));
              }
            }
            
            resolve({
              success: true,
              filePath,
              message: '下载完成'
            });
          });
        });
        
        req.on('error', (err) => {
          fs.unlink(filePath, () => {}); // 删除部分下载的文件
          reject(err);
        });
        
        file.on('error', (err) => {
          fs.unlink(filePath, () => {}); // 删除部分下载的文件
          reject(err);
        });
        
        // 允许用户取消下载
        ipcMain.once(`cancel-download-${modelId}`, () => {
          req.abort();
          fs.unlink(filePath, () => {});
          resolve({
            success: false,
            message: '下载已取消'
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        message: error.message || '下载失败'
      };
    }
  })
} 