import { ipcMain, dialog } from 'electron';
import path from 'path';
import { logger, LogLevel } from '../../utils/logger';

/**
 * 注册日志相关的 IPC 处理器
 */
export function setupLoggerHandlers() {
  // 获取日志目录
  ipcMain.handle('logger:getLogDirectory', () => {
    try {
      return {
        success: true,
        data: logger.getLogDirectory()
      };
    } catch (error) {
      logger.error('LoggerIPC', '获取日志目录失败', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 获取日志文件列表
  ipcMain.handle('logger:getLogFiles', () => {
    try {
      const files = logger.getLogFiles().map(filePath => ({
        path: filePath,
        name: path.basename(filePath),
        size: require('fs').statSync(filePath).size,
        modified: require('fs').statSync(filePath).mtime.toISOString()
      }));
      
      return {
        success: true,
        data: files
      };
    } catch (error) {
      logger.error('LoggerIPC', '获取日志文件列表失败', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 读取日志文件内容
  ipcMain.handle('logger:readLogFile', (_, filePath: string, lines: number = 1000) => {
    try {
      const logs = logger.readLogFile(filePath, lines);
      return {
        success: true,
        data: logs
      };
    } catch (error) {
      logger.error('LoggerIPC', '读取日志文件失败', { filePath, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 获取当前日志文件内容
  ipcMain.handle('logger:getCurrentLogs', (_, lines: number = 500) => {
    try {
      const currentFile = logger.getCurrentLogFile();
      const logs = logger.readLogFile(currentFile, lines);
      return {
        success: true,
        data: logs
      };
    } catch (error) {
      logger.error('LoggerIPC', '获取当前日志失败', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 设置日志级别
  ipcMain.handle('logger:setLevel', (_, level: keyof typeof LogLevel) => {
    try {
      const logLevel = LogLevel[level];
      if (logLevel !== undefined) {
        logger.setLevel(logLevel);
        return {
          success: true,
          data: `日志级别已设置为: ${level}`
        };
      } else {
        throw new Error(`无效的日志级别: ${level}`);
      }
    } catch (error) {
      logger.error('LoggerIPC', '设置日志级别失败', { level, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 清空所有日志
  ipcMain.handle('logger:clearAllLogs', () => {
    try {
      logger.clearAllLogs();
      return {
        success: true,
        data: '所有日志已清空'
      };
    } catch (error) {
      logger.error('LoggerIPC', '清空日志失败', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 导出日志
  ipcMain.handle('logger:exportLogs', async () => {
    try {
      const result = await dialog.showSaveDialog({
        title: '导出日志',
        defaultPath: `jevet-logs-${new Date().toISOString().split('T')[0]}.log`,
        filters: [
          { name: '日志文件', extensions: ['log'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePath) {
        const success = logger.exportLogs(result.filePath);
        if (success) {
          return {
            success: true,
            data: `日志已导出到: ${result.filePath}`
          };
        } else {
          throw new Error('导出失败');
        }
      } else {
        return {
          success: false,
          error: '用户取消了导出'
        };
      }
    } catch (error) {
      logger.error('LoggerIPC', '导出日志失败', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 写入测试日志
  ipcMain.handle('logger:writeTestLog', (_, level: keyof typeof LogLevel, message: string) => {
    try {
      const testData = {
        timestamp: new Date().toISOString(),
        source: 'Frontend Test',
        userAgent: 'Test'
      };

      switch (level) {
        case 'DEBUG':
          logger.debug('Test', message, testData);
          break;
        case 'INFO':
          logger.info('Test', message, testData);
          break;
        case 'WARN':
          logger.warn('Test', message, testData);
          break;
        case 'ERROR':
          logger.error('Test', message, testData);
          break;
        default:
          logger.info('Test', message, testData);
      }

      return {
        success: true,
        data: '测试日志已写入'
      };
    } catch (error) {
      logger.error('LoggerIPC', '写入测试日志失败', { level, message, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 搜索日志
  ipcMain.handle('logger:searchLogs', (_, query: string, level?: keyof typeof LogLevel, maxResults: number = 1000) => {
    try {
      const allLogs: any[] = [];
      const files = logger.getLogFiles();
      
      files.forEach(file => {
        const logs = logger.readLogFile(file);
        allLogs.push(...logs);
      });

      // 过滤日志
      const filteredLogs = allLogs
        .filter(log => {
          // 级别过滤
          if (level && log.level !== level) {
            return false;
          }
          
          // 关键词搜索
          if (query) {
            const searchText = `${log.message} ${log.category} ${JSON.stringify(log.data || {})}`.toLowerCase();
            return searchText.includes(query.toLowerCase());
          }
          
          return true;
        })
        .slice(-maxResults); // 限制结果数量

      return {
        success: true,
        data: filteredLogs
      };
    } catch (error) {
      logger.error('LoggerIPC', '搜索日志失败', { query, level, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  logger.info('LoggerIPC', '日志IPC处理器已注册');
}
