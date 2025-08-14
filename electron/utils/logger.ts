import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  data?: any;
  stack?: string;
}

class Logger {
  private logDir: string;
  private currentLogFile: string;
  private maxLogSize = 10 * 1024 * 1024; // 10MB
  private maxLogFiles = 5;
  private minLevel = LogLevel.INFO;

  constructor() {
    // 初始化日志目录
    const userDataPath = app?.getPath('userData') || os.tmpdir();
    this.logDir = path.join(userDataPath, 'logs');
    this.ensureLogDirectory();
    
    // 设置当前日志文件
    const today = new Date().toISOString().split('T')[0];
    this.currentLogFile = path.join(this.logDir, `app-${today}.log`);
    
    // 清理旧日志
    this.cleanOldLogs();
    
    // 记录启动日志
    this.info('Logger', '日志系统初始化完成', {
      logDir: this.logDir,
      currentLogFile: this.currentLogFile,
      platform: process.platform,
      version: process.version
    });
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 清理旧日志文件
   */
  private cleanOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith('app-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          stat: fs.statSync(path.join(this.logDir, file))
        }))
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

      // 保留最新的几个日志文件
      if (files.length > this.maxLogFiles) {
        const filesToDelete = files.slice(this.maxLogFiles);
        filesToDelete.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            console.warn('删除旧日志文件失败:', file.path, e);
          }
        });
      }
    } catch (e) {
      console.warn('清理旧日志失败:', e);
    }
  }

  /**
   * 轮转日志文件
   */
  private rotateLogFile(): void {
    try {
      const stats = fs.statSync(this.currentLogFile);
      if (stats.size > this.maxLogSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = this.currentLogFile.replace('.log', `-${timestamp}.log`);
        fs.renameSync(this.currentLogFile, rotatedFile);
        
        // 清理旧文件
        this.cleanOldLogs();
      }
    } catch (e) {
      // 文件不存在或其他错误，继续
    }
  }

  /**
   * 写入日志到文件
   */
  private writeToFile(entry: LogEntry): void {
    try {
      this.rotateLogFile();
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.currentLogFile, logLine);
    } catch (e) {
      console.error('写入日志文件失败:', e);
    }
  }

  /**
   * 格式化控制台输出
   */
  private formatForConsole(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const levelIcon = {
      'DEBUG': '🔍',
      'INFO': 'ℹ️',
      'WARN': '⚠️',
      'ERROR': '❌'
    }[entry.level] || '';
    
    let message = `${levelIcon} [${time}] [${entry.category}] ${entry.message}`;
    
    if (entry.data && Object.keys(entry.data).length > 0) {
      message += '\n  数据: ' + JSON.stringify(entry.data, null, 2);
    }
    
    if (entry.stack) {
      message += '\n  堆栈: ' + entry.stack;
    }
    
    return message;
  }

  /**
   * 记录日志的通用方法
   */
  private log(level: LogLevel, category: string, message: string, data?: any, error?: Error): void {
    if (level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      category,
      message,
      data,
      stack: error?.stack
    };

    // 控制台输出
    const consoleMessage = this.formatForConsole(entry);
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(consoleMessage);
        break;
      case LogLevel.INFO:
        console.info(consoleMessage);
        break;
      case LogLevel.WARN:
        console.warn(consoleMessage);
        break;
      case LogLevel.ERROR:
        console.error(consoleMessage);
        break;
    }

    // 写入文件
    this.writeToFile(entry);
  }

  /**
   * Debug级别日志
   */
  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  /**
   * Info级别日志
   */
  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  /**
   * Warning级别日志
   */
  warn(category: string, message: string, data?: any, error?: Error): void {
    this.log(LogLevel.WARN, category, message, data, error);
  }

  /**
   * Error级别日志
   */
  error(category: string, message: string, data?: any, error?: Error): void {
    this.log(LogLevel.ERROR, category, message, data, error);
  }

  /**
   * 设置最小日志级别
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
    this.info('Logger', `日志级别设置为: ${LogLevel[level]}`);
  }

  /**
   * 获取日志目录
   */
  getLogDirectory(): string {
    return this.logDir;
  }

  /**
   * 获取当前日志文件路径
   */
  getCurrentLogFile(): string {
    return this.currentLogFile;
  }

  /**
   * 获取所有日志文件
   */
  getLogFiles(): string[] {
    try {
      return fs.readdirSync(this.logDir)
        .filter(file => file.endsWith('.log'))
        .map(file => path.join(this.logDir, file))
        .sort((a, b) => {
          const statA = fs.statSync(a);
          const statB = fs.statSync(b);
          return statB.mtime.getTime() - statA.mtime.getTime();
        });
    } catch (e) {
      this.error('Logger', '获取日志文件列表失败', { error: e.message });
      return [];
    }
  }

  /**
   * 读取日志文件内容
   */
  readLogFile(filePath: string, lines = 1000): LogEntry[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const logLines = content.trim().split('\n').slice(-lines);
      
      return logLines
        .map(line => {
          try {
            return JSON.parse(line) as LogEntry;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is LogEntry => entry !== null);
    } catch (e) {
      this.error('Logger', '读取日志文件失败', { filePath, error: e.message });
      return [];
    }
  }

  /**
   * 清空所有日志
   */
  clearAllLogs(): void {
    try {
      const files = this.getLogFiles();
      files.forEach(file => fs.unlinkSync(file));
      this.info('Logger', '已清空所有日志文件');
    } catch (e) {
      this.error('Logger', '清空日志失败', { error: e.message });
    }
  }

  /**
   * 导出日志到指定文件
   */
  exportLogs(exportPath: string): boolean {
    try {
      const allLogs: LogEntry[] = [];
      const files = this.getLogFiles();
      
      files.forEach(file => {
        const logs = this.readLogFile(file);
        allLogs.push(...logs);
      });

      // 按时间排序
      allLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // 写入导出文件
      const exportContent = allLogs.map(entry => JSON.stringify(entry)).join('\n');
      fs.writeFileSync(exportPath, exportContent);

      this.info('Logger', '日志导出成功', { exportPath, totalEntries: allLogs.length });
      return true;
    } catch (e) {
      this.error('Logger', '日志导出失败', { exportPath, error: e.message });
      return false;
    }
  }
}

// 创建全局日志实例
export const logger = new Logger();

// 导出便捷函数
export const log = {
  debug: (category: string, message: string, data?: any) => logger.debug(category, message, data),
  info: (category: string, message: string, data?: any) => logger.info(category, message, data),
  warn: (category: string, message: string, data?: any, error?: Error) => logger.warn(category, message, data, error),
  error: (category: string, message: string, data?: any, error?: Error) => logger.error(category, message, data, error),
  setLevel: (level: LogLevel) => logger.setLevel(level)
};
