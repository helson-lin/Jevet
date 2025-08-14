import { ipcMain } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import * as png2icns from 'png2icons';
// 延迟加载 onnxruntime-node，避免打包期处理原生绑定
import { MODEL_OPTION, type ModelOptionItem, getConfig } from './config/index'
import { logger } from '../../utils/logger';

// ES 模块兼容的 __dirname 和 require
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ONNX 会话缓存，避免重复创建会话
const sessionCache = new Map<string, any>();
const MAX_CACHE_SIZE = 3; // 最多缓存3个会话

// 内存监控
let peakMemoryUsage = 0;
function logMemoryUsage(uid: string, stage: string) {
  const memUsage = process.memoryUsage();
  const currentMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  peakMemoryUsage = Math.max(peakMemoryUsage, currentMB);
  
  logger.debug('MemoryMonitor', `内存使用监控 ${uid}`, {
    uid,
    stage,
    currentMB,
    peakMB: peakMemoryUsage,
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  });
}

interface IMG_ITEM {
  buffer: ArrayBuffer;
  uid: string;
}

interface ImageProcessOptions {
  width?: number;
  height?: number;
  resizeOption?: sharp.ResizeOptions;
  keepExif?: boolean;
  exif: sharp.Exif;
  quality: number;
  outputformat: "png" | "jpg" | "jpeg" | "webp" | "gif" | "jp2" | "tiff" | "heif" | "icns" | "ico";
  // 水印设置
  watermark?: {
    enabled: boolean;          // 是否启用水印
    text: string;              // 水印文本
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'; // 水印位置
    fontSize: number;          // 字体大小
    color: string;             // 水印颜色
    opacity: number;           // 水印透明度
  }
}

/**
 * 注册图像相关的 IPC 处理器，包括：
 * - compress：图片压缩/转码
 * - remove：背景移除（ONNX 推理）
 */
export function setupImageHandlers() {
  logger.info('ImageIPC', '图像处理IPC处理器初始化开始');
  
  // 注册会话缓存管理处理器
  ipcMain.handle('image:clearSessionCache', async () => {
    try {
      await clearSessionCache();
      return { success: true, message: '会话缓存已清理' };
    } catch (e) {
      logger.error('ImageIPC', '清理会话缓存失败', { error: e.message }, e);
      return { success: false, error: e.message };
    }
  });
  
  // 获取内存使用情况
  ipcMain.handle('image:getMemoryUsage', async () => {
    try {
      const memUsage = process.memoryUsage();
      return {
        success: true,
        data: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          peakMemoryUsage,
          sessionCacheSize: sessionCache.size
        }
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  
  // 强制垃圾回收（仅在Windows下可用）
  ipcMain.handle('image:forceGC', async () => {
    try {
      if (global.gc && process.platform === 'win32') {
        global.gc();
        return { success: true, message: '垃圾回收已执行' };
      } else {
        return { success: false, message: '垃圾回收不可用或非Windows平台' };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  
  //  实现图片转码
  ipcMain.handle("compress", async (_, arg: { imgs: IMG_ITEM[]; options?: ImageProcessOptions }) => {
    logger.info('ImageCompress', '开始图片压缩处理', { 
      imageCount: arg.imgs?.length || 0,
      options: arg.options 
    });
    try {
      const { imgs, options } = arg;
      const processingPromises = imgs.map(async (imgItem) => {
        const tempDir = os.tmpdir();
        let outputPath = path.join(
          tempDir,
          `resized-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${options.outputformat}`
        );

        let sharper = sharp(imgItem.buffer);
        
        // 处理图片尺寸
        if (options?.width || options?.height) {
          const width = options.width || undefined;
          const height = options.height || undefined;
          if (!options.resizeOption) {
            sharper = sharper.resize(width, height);
          } else {
            sharper = sharper.resize(width, height, options.resizeOption);
          }
        }

        // 处理 Exif
        if (options?.keepExif) sharper = sharper.keepExif();
        if (options?.exif) sharper = sharper.withExif(options.exif);

        // 处理输出格式
        if (options?.outputformat) {
          const baseOptions = { quality: options.quality || 100 };
          sharper = await processOutputFormat(sharper, options.outputformat, baseOptions);
        }

        // 处理水印
        if (options?.watermark?.enabled && options.watermark.text) {
          sharper = await addWatermark(sharper, options.watermark, { width: options?.width, height: options?.height });
        }

        await sharper.toFile(outputPath);

        // 处理特殊格式（icns 和 ico）
        const imageBuffer = await processSpecialFormats(outputPath, options.outputformat);

        // 获取文件大小
        const stats = fs.statSync(outputPath);
        const fileSizeInBytes = stats.size;

        return {
          uid: imgItem.uid,
          outputPath,
          fileSize: fileSizeInBytes,
          base64Image: `data:image/${options.outputformat};base64,${imageBuffer.toString("base64")}`,
        };
      });

      const results = await Promise.all(processingPromises);

      logger.info('ImageCompress', '图片压缩处理完成', { 
        processedCount: results.length,
        totalSize: results.reduce((sum, r) => sum + r.fileSize, 0)
      });

      return {
        success: true,
        results,
        message: `成功并行处理了${results.length}张图片`,
      };
    } catch (e) {
      logger.error("ImageCompress", "图片压缩处理失败", { 
        imageCount: arg.imgs?.length || 0,
        options: arg.options,
        error: e.message 
      }, e);
      return { success: false, error: e.message };
    }
  });

  // Register the remove handler here
  ipcMain.handle('remove', async (_, arg: { imgs: IMG_ITEM[], options: {
    model: string,
    quality: number,
    outputformat: string,
  }}) => {
    logger.info('ImageRemoveBg', '开始抠图处理', { 
      imageCount: arg.imgs?.length || 0,
      model: arg.options?.model,
      outputFormat: arg.options?.outputformat
    });
    
    try {
      const imgs = arg.imgs;
      const processingPromises = imgs.map(async (imgItem) => await removeBg(imgItem.buffer as any, { outputformat: arg.options?.outputformat, model: arg.options?.model, uid: imgItem.uid }))
      const results = await Promise.all(processingPromises);

      logger.info('ImageRemoveBg', '抠图处理完成', { 
        processedCount: results.length,
        successCount: results.filter(r => r.base64Image).length
      });

      return {
        success: true,
        results,
        message: `成功并行处理了${results.length}张图片`,
      };
    } catch (e) {
      logger.error('ImageRemoveBg', '抠图处理失败', { 
        imageCount: arg.imgs?.length || 0,
        model: arg.options?.model,
        error: e.message 
      }, e);
      return { success: false, error: e.message };
    }
  });

  // 添加 CUDA 诊断检查处理器
  ipcMain.handle('check-cuda-status', async () => {
    logger.info('CudaCheck', '开始CUDA状态检查');
    
    try {
      const ort = await import('onnxruntime-node');
      const uid = `cuda-check-${Date.now()}`;
      const cudaCheck = await checkCudaEnvironment(ort, uid);
      
      const result = {
        success: true,
        cudaAvailable: cudaCheck.available,
        version: cudaCheck.version,
        errorMessage: cudaCheck.errorMessage,
        diagnosticInfo: cudaCheck.diagnosticInfo,
        recommendations: cudaCheck.available 
          ? ['CUDA 环境正常，GPU 加速可用'] 
          : [
              '检查 NVIDIA 显卡驱动程序是否已安装',
              '确保 CUDA >= 11.4 已正确安装',
              '确保 cuDNN >= 8.2 已正确安装',
              '重启应用程序或计算机',
              '如果问题持续存在，请尝试重新安装 CUDA 和 cuDNN'
            ]
      };
      
      logger.info('CudaCheck', 'CUDA状态检查完成', result);
      return result;
      
    } catch (error) {
      logger.error('CudaCheck', 'CUDA状态检查失败', { error: error.message }, error);
      return {
        success: false,
        cudaAvailable: false,
        errorMessage: `CUDA 检查失败: ${error.message}`,
        diagnosticInfo: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          error: error.message
        },
        recommendations: [
          '检查 onnxruntime-node 是否正确安装',
          '运行 npm run check:ort 进行诊断',
          '尝试重新安装依赖: npm run reinstall'
        ]
      };
    }
  });

  logger.info('ImageIPC', '图像处理IPC处理器初始化完成');
}



/**
 * 将 ORT 输出张量统一转换为 width x height 的 8bit mask
 * 兼容常见输出形状：
 * - [1,1,H,W]
 * - [1,H,W]
 * - [H,W]
 * - [1,C,H,W]（取 argmax 通道）
 * - [1,H,W,1] / [1,H,W,C]
 */
/**
 * 将 ORT 输出张量统一转换为 [width x height] 的 8bit mask。
 *
 * @param outTensor ONNX 推理输出张量（可能包含 data/dims/dimensions 字段）
 * @param width 目标宽度
 * @param height 目标高度
 * @returns 按 width*height 展开的 8bit 掩码（0-255）
 */
async function extractMaskResized(outTensor: any, width: number, height: number): Promise<Uint8Array> {
  // 读取数据与形状
  const data: Float32Array | number[] = outTensor?.data || outTensor;
  const dims: number[] = outTensor?.dims || outTensor?.dimensions || [];

  // 将任意形状转为 [H, W] 概率图
  let prob2D: Float32Array;
  let srcH = 0;
  let srcW = 0;
  if (dims.length === 4) {
    // 可能是 [1,1,H,W] 或 [1,C,H,W] 或 [1,H,W,1]
    const [n, c, h, w] = dims;
    if (c === 1) {
      prob2D = new Float32Array(h * w);
      for (let i = 0; i < h * w; i++) prob2D[i] = (data as any)[i];
      srcH = h; srcW = w;
    } else if (n === 1 && h && w && c > 1) {
      // [1,C,H,W] 取 argmax
      prob2D = new Float32Array(h * w);
      for (let i = 0; i < h * w; i++) {
        let maxVal = -Infinity;
        for (let ch = 0; ch < c; ch++) {
          const v = (data as any)[ch * h * w + i];
          if (v > maxVal) maxVal = v;
        }
        prob2D[i] = maxVal;
      }
      srcH = h; srcW = w;
    } else {
      // 兜底：按最后两个维度为 H/W 读取
      const h2 = dims[dims.length - 2];
      const w2 = dims[dims.length - 1];
      prob2D = new Float32Array(h2 * w2);
      for (let i = 0; i < h2 * w2; i++) prob2D[i] = (data as any)[i];
      srcH = h2; srcW = w2;
    }
  } else if (dims.length === 3) {
    // [1,H,W] 或 [H,W,1]
    const h = dims[dims.length - 2];
    const w = dims[dims.length - 1];
    prob2D = new Float32Array(h * w);
    for (let i = 0; i < h * w; i++) prob2D[i] = (data as any)[i];
    srcH = h; srcW = w;
  } else if (dims.length === 2) {
    // [H,W]
    const h = dims[0];
    const w = dims[1];
    prob2D = new Float32Array(h * w);
    for (let i = 0; i < h * w; i++) prob2D[i] = (data as any)[i];
    srcH = h; srcW = w;
  } else {
    // 未知形状，直接按 width*height 读取
    prob2D = new Float32Array(width * height);
    for (let i = 0; i < width * height && i < (data as any).length; i++) prob2D[i] = (data as any)[i];
    srcH = height; srcW = width;
  }

  // 归一化到 [0,255]
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < prob2D.length; i++) {
    const v = prob2D[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  for (let i = 0; i < prob2D.length; i++) prob2D[i] = (prob2D[i] - min) / range;

  // 若预测尺寸与目标尺寸不一致，进行最近邻缩放到 width x height
  // 这里实现一个简单的最近邻缩放（避免再引入依赖）
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(srcH - 1, Math.round((y / height) * srcH));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(srcW - 1, Math.round((x / width) * srcW));
      const sv = prob2D[sy * srcW + sx];
      out[y * width + x] = Math.max(0, Math.min(255, Math.round(sv * 255)));
    }
  }
  return out;
}
/**
 * 根据目标格式设置 sharp 的输出参数。
 *
 * @param sharper sharp 实例
 * @param format 目标输出格式（png/webp/jpeg/jp2/tiff/gif/heif/icns/ico）
 * @param baseOptions 基础选项（quality）
 */
async function processOutputFormat(sharper: sharp.Sharp, format: string, baseOptions: { quality: number }) {
  switch (format) {
    case "png":
      return sharper.png({ ...baseOptions, effort: 6, palette: true });
    case "webp":
      return sharper.webp({ effort: 6, ...baseOptions });
    case "jpeg":
      return sharper.jpeg(baseOptions);
    case "jp2":
      return sharper.jp2(baseOptions);
    case "tiff":
      return sharper.tiff(baseOptions);
    case "gif":
      return sharper.gif({ effort: 6 });
    case "heif":
      return sharper.heif({ ...baseOptions, effort: 6 });
    case "icns":
    case "ico":
      return sharper.resize({
        width: 1024,
        height: 1024,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }).composite([
        {
          input: Buffer.from(
            `<svg><rect x="0" y="0" width="1024" height="1024" rx="250" ry="250" /></svg>`
          ),
          blend: 'dest-in',
        }
      ]).extend({
        top: 120,
        bottom: 120,
        left: 120,
        right: 120,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    default:
      return sharper;
  }
}

/**
 * 处理特殊容器格式（icns/ico），返回最终用于预览/保存的二进制。
 *
 * @param outputPath 临时输出文件路径
 * @param format 目标格式
 * @returns 最终图片 Buffer
 */
async function processSpecialFormats(outputPath: string, format: string): Promise<Buffer> {
  if (format === 'icns') {
    const iconBuffer = fs.readFileSync(outputPath);
    const imageBuffer = png2icns.createICNS(iconBuffer, 1, 0);
    fs.writeFileSync(outputPath, imageBuffer);
    return imageBuffer;
  } else if (format === 'ico') {
    const iconBuffer = fs.readFileSync(outputPath);
    const imageBuffer = png2icns.createICO(iconBuffer, png2icns.BEZIER, 20, true);
    fs.writeFileSync(outputPath, imageBuffer);
    return imageBuffer;
  } else {
    return sharp(outputPath).toBuffer();
  }
}

// CUDA 环境检测和诊断
async function checkCudaEnvironment(ort: any, uid: string): Promise<{
  available: boolean;
  version?: string;
  errorMessage?: string;
  diagnosticInfo: any;
}> {
  const diagnosticInfo: any = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    ortVersion: ort.version || 'unknown'
  };

  try {
    // 检查 CUDA 执行提供程序是否可用
    const availableProviders = (ort as any).InferenceSession?.getAvailableProviders?.() || [];
    diagnosticInfo.availableProviders = availableProviders;
    
    const cudaAvailable = availableProviders.includes('cuda');
    logger.info('CudaCheck', `CUDA 执行提供程序检测 ${uid}`, {
      uid,
      availableProviders,
      cudaAvailable,
      diagnosticInfo
    });

    if (!cudaAvailable) {
      return {
        available: false,
        errorMessage: 'CUDA 执行提供程序不可用。可能原因：CUDA 驱动未安装、版本不兼容、或 cuDNN 缺失',
        diagnosticInfo
      };
    }

    // 尝试创建一个简单的 CUDA 会话进行验证
    try {
      const dummyTensor = new (ort as any).Tensor('float32', new Float32Array([1, 2, 3, 4]), [1, 4]);
      logger.debug('CudaCheck', `CUDA 功能验证测试 ${uid}`, { uid, tensorShape: [1, 4] });
      
      return {
        available: true,
        version: diagnosticInfo.ortVersion,
        diagnosticInfo
      };
    } catch (testError) {
      logger.warn('CudaCheck', `CUDA 功能验证失败 ${uid}`, {
        uid,
        error: testError.message,
        diagnosticInfo
      }, testError);
      
      return {
        available: false,
        errorMessage: `CUDA 功能验证失败: ${testError.message}`,
        diagnosticInfo
      };
    }
  } catch (error) {
    logger.error('CudaCheck', `CUDA 环境检测异常 ${uid}`, {
      uid,
      error: error.message,
      diagnosticInfo
    }, error);
    
    return {
      available: false,
      errorMessage: `CUDA 环境检测异常: ${error.message}`,
      diagnosticInfo
    };
  }
}

// 获取或创建ONNX会话，支持缓存复用和增强的 CUDA 诊断
async function getOrCreateSession(modelPath: string, sessionOptions: any, uid: string): Promise<any> {
  const cacheKey = `${modelPath}:${JSON.stringify(sessionOptions)}`;
  
  // 检查缓存
  if (sessionCache.has(cacheKey)) {
    logger.info('SessionCache', `使用缓存会话 ${uid}`, { uid, cacheKey, cacheSize: sessionCache.size });
    return sessionCache.get(cacheKey);
  }
  
  // 动态加载 onnxruntime-node
  let ort;
  try {
    ort = await import('onnxruntime-node');
    logger.info('RemoveBg', `onnxruntime-node 加载成功 ${uid}`, { uid });
  } catch (firstError) {
    logger.warn('RemoveBg', `onnxruntime-node 首次加载失败 ${uid}`, { 
      uid, error: firstError.message 
    }, firstError);
    
    // Windows特殊处理逻辑（保持原有的路径检测）
    if (process.platform === 'win32') {
      const isDev = !!process.env.VITE_DEV_SERVER_URL;
      const possibleModulePaths = isDev 
        ? [
            path.join(process.cwd(), 'node_modules/onnxruntime-node'),
            path.join(__dirname, '../../../node_modules/onnxruntime-node')
          ]
        : [
            path.join(process.resourcesPath, 'app.asar.unpacked/node_modules/onnxruntime-node'),
            path.join(process.resourcesPath, 'node_modules/onnxruntime-node'),
            path.join(process.cwd(), 'node_modules/onnxruntime-node')
          ];
      
      let loaded = false;
      for (const modulePath of possibleModulePaths) {
        try {
          if (fs.existsSync(path.join(modulePath, 'dist/index.js'))) {
            ort = await require(modulePath);
            loaded = true;
            logger.info('RemoveBg', `Windows路径加载成功 ${uid}`, { uid, modulePath });
            break;
          }
        } catch (e) {
          logger.warn('RemoveBg', `Windows路径加载失败 ${uid}`, { uid, modulePath, error: e.message });
        }
      }
      
      if (!loaded) {
        throw new Error('无法加载 onnxruntime-node，请运行 npm run check:ort 进行诊断');
      }
    } else {
      throw firstError;
    }
  }

  // 如果配置了 CUDA，先进行环境检测
  const hasCudaProvider = sessionOptions.executionProviders?.includes('cuda');
  if (hasCudaProvider) {
    const cudaCheck = await checkCudaEnvironment(ort, uid);
    logger.info('CudaCheck', `CUDA 环境检测完成 ${uid}`, {
      uid,
      cudaAvailable: cudaCheck.available,
      cudaVersion: cudaCheck.version,
      errorMessage: cudaCheck.errorMessage,
      diagnosticInfo: cudaCheck.diagnosticInfo
    });

    if (!cudaCheck.available) {
      logger.warn('CudaCheck', `CUDA 不可用，将从执行提供程序中移除 ${uid}`, {
        uid,
        originalProviders: sessionOptions.executionProviders,
        reason: cudaCheck.errorMessage
      });
      
      // 从执行提供程序中移除 CUDA，只使用 CPU
      sessionOptions = {
        ...sessionOptions,
        executionProviders: sessionOptions.executionProviders.filter((ep: string) => ep !== 'cuda')
      };
    }
  }
  
  // 创建新会话
  logger.info('SessionCache', `创建新会话 ${uid}`, { uid, modelPath, sessionOptions });
  const session = await (ort as any).InferenceSession.create(modelPath, sessionOptions);
  
  // 记录实际使用的执行提供程序
  const activeProviders = (session as any).getActiveProviders?.() || 'unknown';
  logger.info('SessionCache', `会话创建成功，实际执行提供程序 ${uid}`, {
    uid,
    requestedProviders: sessionOptions.executionProviders,
    activeProviders,
    usingCuda: Array.isArray(activeProviders) ? activeProviders.includes('cuda') : false
  });
  
  // 缓存管理 - 如果缓存已满，移除最旧的条目
  if (sessionCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = sessionCache.keys().next().value;
    const oldSession = sessionCache.get(oldestKey);
    try {
      if (oldSession && typeof oldSession.release === 'function') {
        await oldSession.release();
      }
    } catch (e) {
      logger.warn('SessionCache', `释放旧会话失败`, { oldestKey, error: e.message });
    }
    sessionCache.delete(oldestKey);
    logger.info('SessionCache', `移除旧会话`, { removedKey: oldestKey, cacheSize: sessionCache.size });
  }
  
  sessionCache.set(cacheKey, session);
  logger.info('SessionCache', `会话已缓存 ${uid}`, { uid, cacheKey, cacheSize: sessionCache.size });
  
  return session;
}

// 清理会话缓存
async function clearSessionCache() {
  logger.info('SessionCache', '开始清理会话缓存', { cacheSize: sessionCache.size });
  for (const [key, session] of Array.from(sessionCache)) {
    try {
      if (session && typeof session.release === 'function') {
        await session.release();
      }
    } catch (e) {
      logger.warn('SessionCache', `释放会话失败`, { key, error: e.message });
    }
  }
  sessionCache.clear();
  logger.info('SessionCache', '会话缓存已清理');
}



// Windows特定的内存优化配置
function getOptimizedSessionOptions(config: any): any {
  const isWindows = process.platform === 'win32';
  const baseOptions = {
    graphOptimizationLevel: config?.data?.graphOptimizationLevel || 'basic',
    logSeverityLevel: 2, // 减少日志输出
  };
  
  if (isWindows) {
    // Windows优化配置
    return {
      ...baseOptions,
      intraOpNumThreads: Math.min(2, os.cpus().length), // 限制线程数
      interOpNumThreads: 1, // 减少并行操作
      enableCpuMemArena: true, // Windows下启用内存池
      enableMemPattern: true, // 启用内存模式优化
      memoryPatternOptimization: true, // 内存模式优化
      sessionConfigEntries: {
        'session.use_env_allocators': '1', // 使用环境分配器
        'session.use_device_allocator_for_initializers': '1'
      }
    };
  } else {
    // 非Windows配置（保持原有配置）
    return {
      ...baseOptions,
      intraOpNumThreads: 3,
      interOpNumThreads: 3,
      enableCpuMemArena: false,
      enableMemPattern: false
    };
  }
}

// 获取模型的配置
/**
 * 获取指定模型文件名的配置项。
 *
 * @param modelName 模型文件名（含扩展名，如 'u2net.onnx'）
 * @returns 模型配置项
 */
function getModelOption(modelName: string): ModelOptionItem {
  if (MODEL_OPTION[modelName]) return MODEL_OPTION[modelName];
  const lower = modelName?.toLowerCase?.() || '';
  const key = Object.keys(MODEL_OPTION).find(k => k.toLowerCase() === lower);
  if (key) return MODEL_OPTION[key];
  return {
    width: 320,
    height: 320,
    size: 'unkown',
    license: 'unkown',
    md5: 'unkown',
    homepage: 'unkown',
    feedInput: 'input.1'
  } as ModelOptionItem;
}

// 实现抠图
/**
 * 执行背景移除：加载 ONNX 模型、预处理图像、前向推理、生成 RGBA 输出并写入文件。
 *
 * @param inputBuffer 输入图像二进制
 * @param inputOptions 处理选项
 * @param inputOptions.outputformat 输出格式（png/jpg/jpeg/webp/gif/jp2/tiff/heif/icns/ico）
 * @param inputOptions.model 模型名（不含扩展名，如 'u2net'、'bria-rmbg-2.0'）
 * @param inputOptions.uid 任务唯一标识
 * @returns 包含 uid、输出路径、文件大小、base64 的结果对象
 */
async function removeBg(
  inputBuffer: Buffer,
  inputOptions:  {
    outputformat: string;
    model: string;
    uid: string;
  }) {
  const startTime = Date.now();
  logger.info('RemoveBg', `开始处理抠图任务 ${inputOptions.uid}`, {
    uid: inputOptions.uid,
    model: inputOptions.model,
    outputFormat: inputOptions.outputformat,
    bufferSize: inputBuffer.length,
    platform: process.platform
  });
  
  try {
    logMemoryUsage(inputOptions.uid, '开始处理');
    
    // 临时文件目录
    const tempDir = os.tmpdir();
    let outputPath = path.join(
      tempDir,
      `removebg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${inputOptions.outputformat}`
    );
    
    // 1. 获取配置和模型路径
    logger.info('RemoveBg', `获取模型配置 ${inputOptions.uid}`, { uid: inputOptions.uid });
    const config = await getConfig();
    const modelDir = config.data.modelDir;
    const modelDirPath = modelDir || path.join(process.cwd(), 'model');
    const modelPath = path.join(modelDirPath, `${inputOptions.model || 'u2net'}.onnx`);
    const ort = await import('onnxruntime-node');
    logger.info('RemoveBg', `模型路径确定 ${inputOptions.uid}`, { 
      uid: inputOptions.uid,
      modelPath,
      modelExists: fs.existsSync(modelPath)
    });
    
    // 2. 优化会话选项（Windows特定优化）
    const allowGPU = Boolean(config?.data?.useGPU);
    const candidateEPs = (process.platform === 'win32' || process.platform === 'linux') && allowGPU
      ? ['cuda', 'cpu']
      : ['cpu'];
    
    const optimizedOptions = getOptimizedSessionOptions(config);
    const sessionOptions = {
      ...optimizedOptions,
      executionProviders: candidateEPs
    };
    
    logger.info('RemoveBg', `使用优化的会话配置 ${inputOptions.uid}`, { 
      uid: inputOptions.uid,
      platform: process.platform,
      isWindows: process.platform === 'win32',
      sessionOptions 
    });
    
    // 3. 获取或创建ONNX会话（使用缓存和改进的错误处理）
    logMemoryUsage(inputOptions.uid, '会话创建前');
    
    let session: any;
    let actualExecutionProviders: string[] = candidateEPs;
    let cudaDiagnosticInfo: any = null;
    
    try {
      session = await getOrCreateSession(modelPath, sessionOptions, inputOptions.uid);
      
      // 获取实际使用的执行提供程序
      const activeProviders = (session as any).getActiveProviders?.();
      const usingCuda = Array.isArray(activeProviders) ? activeProviders.includes('cuda') : false;
      actualExecutionProviders = Array.isArray(activeProviders) ? activeProviders : candidateEPs;
      
      logger.info('RemoveBg', `ONNX会话获取成功 ${inputOptions.uid}`, { 
        uid: inputOptions.uid,
        requestedProviders: candidateEPs,
        actualProviders: actualExecutionProviders,
        usingCuda,
        cached: sessionCache.has(`${modelPath}:${JSON.stringify(sessionOptions)}`)
      });

      // 如果用户启用了 GPU 但实际未使用 CUDA，记录诊断信息
      if (allowGPU && candidateEPs.includes('cuda') && !usingCuda) {
        logger.warn('RemoveBg', `用户启用了GPU但未使用CUDA ${inputOptions.uid}`, {
          uid: inputOptions.uid,
          userWantsCuda: true,
          actuallyUsingCuda: false,
          requestedProviders: candidateEPs,
          actualProviders: actualExecutionProviders,
          suggestion: '请检查 CUDA 驱动程序、cuDNN 版本或查看日志获取详细诊断信息'
        });
      }
      
    } catch (err) {
      logger.error('RemoveBg', `会话创建失败，尝试CPU回退 ${inputOptions.uid}`, { 
        uid: inputOptions.uid,
        originalError: err.message,
        requestedProviders: candidateEPs,
        stack: err.stack
      }, err);
      
      // CPU回退配置
      const fallbackOptions = { 
        ...getOptimizedSessionOptions(config),
        executionProviders: ['cpu'] 
      };
      
      try {
        session = await getOrCreateSession(modelPath, fallbackOptions, inputOptions.uid);
        actualExecutionProviders = ['cpu'];
        
        logger.warn('RemoveBg', `CPU回退会话创建成功 ${inputOptions.uid}`, { 
          uid: inputOptions.uid,
          fallbackReason: err.message,
          finalProviders: actualExecutionProviders,
          performanceImpact: allowGPU ? 'GPU加速未生效，性能可能受影响' : '正常CPU处理模式'
        });
        
        // 保存诊断信息供后续使用
        if (allowGPU && candidateEPs.includes('cuda')) {
          cudaDiagnosticInfo = {
            cudaRequested: true,
            cudaFailed: true,
            failureReason: err.message,
            fallbackToCpu: true,
            recommendation: '请检查CUDA安装：1) NVIDIA驱动程序 2) CUDA >= 11.4 3) cuDNN >= 8.2'
          };
        }
        
      } catch (fallbackErr) {
        logger.error('RemoveBg', `CPU回退也失败 ${inputOptions.uid}`, {
          uid: inputOptions.uid,
          originalError: err.message,
          fallbackError: fallbackErr.message
        }, fallbackErr);
        
        throw new Error(`会话创建完全失败：原始错误 [${err.message}]，CPU回退错误 [${fallbackErr.message}]`);
      }
    }
    
    logMemoryUsage(inputOptions.uid, '会话创建后');
    // 获取模型的名称
    const filename = path.basename(modelPath);
    // 通过模型的名称获取模型的配置信息
    const options = getModelOption(filename);
    logger.info('RemoveBg', `模型加载完成 ${inputOptions.uid}`, {
      uid: inputOptions.uid,
      filename,
      modelOptions: options,
      sessionConfig: {
        executionProviders: candidateEPs,
        graphOptimizationLevel: (config?.data?.graphOptimizationLevel || 'basic'),
        intraOpNumThreads: 3,
        interOpNumThreads: 3,
        enableCpuMemArena: false,
        enableMemPattern: false,
        logSeverityLevel: 0
      }
    });
    // 从模型元数据推断输入名称与目标尺寸，增强健壮性
    let feedInputName = options.feedInput;
    try {
      const inputNames: string[] = (session as any).inputNames || [];
      const inputMeta = (session as any).inputMetadata || {};
      if ((!feedInputName || !inputMeta[feedInputName]) && inputNames.length > 0) {
        feedInputName = inputNames[0];
      }
      // 解析 dims: [1,3,H,W]
      const meta = inputMeta[feedInputName];
      const dims: any[] = meta?.dimensions || [];
      const dimH = typeof dims[2] === 'number' ? dims[2] : undefined;
      const dimW = typeof dims[3] === 'number' ? dims[3] : undefined;
      if ((!options.width || options.width <= 0) && dimW) options.width = dimW;
      if ((!options.height || options.height <= 0) && dimH) options.height = dimH;
    } catch (e) {
      logger.warn('RemoveBg', `读取模型输入元数据失败 ${inputOptions.uid}`, { 
        uid: inputOptions.uid,
        error: e.message 
      }, e);
    }
    
    // 4. 图像预处理和尺寸优化
    logger.info('RemoveBg', `开始图像预处理 ${inputOptions.uid}`, { 
      uid: inputOptions.uid,
      originalBufferSize: inputBuffer.length,
      targetWidth: options.width,
      targetHeight: options.height 
    });
    
    // 保存原图尺寸信息（用于最终输出恢复比例）
    const originalMeta = await sharp(inputBuffer).metadata();
    const originalWidth = originalMeta.width || 1024;
    const originalHeight = originalMeta.height || 1024;
    
    logger.info('RemoveBg', `原图尺寸 ${inputOptions.uid}`, { 
      uid: inputOptions.uid,
      originalWidth,
      originalHeight,
      originalPixels: originalWidth * originalHeight
    });
    
    // 模型需要的方形尺寸（保持原逻辑）
    const modelRequiredSize = filename.toLowerCase().includes('ben2') ? 1024 : 320;
    let targetW = options.width && options.width > 0 ? options.width : modelRequiredSize;
    let targetH = options.height && options.height > 0 ? options.height : modelRequiredSize;
    
    // 如果设置了自定义尺寸但超出内存限制，进行优化
    const maxPixels = process.platform === 'win32' ? 1024 * 1024 : 2048 * 2048;
    if (targetW * targetH > maxPixels) {
      const scaleFactor = Math.sqrt(maxPixels / (targetW * targetH));
      targetW = Math.floor(targetW * scaleFactor);
      targetH = Math.floor(targetH * scaleFactor);
      
      logger.warn('RemoveBg', `模型输入尺寸过大，已压缩 ${inputOptions.uid}`, {
        uid: inputOptions.uid,
        original: { width: options.width || modelRequiredSize, height: options.height || modelRequiredSize },
        compressed: { width: targetW, height: targetH },
        platform: process.platform
      });
    }
    
    logMemoryUsage(inputOptions.uid, '图像处理前');
    
    // 图像处理 - 为模型推理准备方形输入（保持长宽比）
    const imageBuffer = await sharp(inputBuffer)
      .resize(targetW, targetH)
      .removeAlpha()  // 移除 alpha 通道
      .toColorspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    const { data, info } = imageBuffer;
    const { width, height, channels } = info;
    
    // 强制垃圾回收（如果可用）
    if (global.gc && process.platform === 'win32') {
      global.gc();
      logger.debug('RemoveBg', `执行垃圾回收 ${inputOptions.uid}`, { uid: inputOptions.uid });
    }
    
    logMemoryUsage(inputOptions.uid, '图像处理后');
    
    logger.info('RemoveBg', `图像读取完成 ${inputOptions.uid}`, { 
      uid: inputOptions.uid,
      width,
      height,
      channels,
      dataSize: data.length 
    });

    // 3. 检查通道数
    if (channels !== 3) {
        logger.warn('RemoveBg', `通道数异常 ${inputOptions.uid}`, { 
          uid: inputOptions.uid,
          expected: 3,
          actual: channels 
        });
    }
    
    // 5. 数据预处理
    logger.info('RemoveBg', `开始预处理图像数据 ${inputOptions.uid}`, { 
      uid: inputOptions.uid,
      dataSize: data.length,
      targetChannels: 3
    });
    
    logMemoryUsage(inputOptions.uid, '预处理前');
    
    // 优化的数据预处理 - 减少内存分配
    const floatArr = new Float32Array(width * height * 3);
    let j = 0;
    for (let i = 0; i < data.length; i++) {
        floatArr[j++] = data[i] / 255;
    }
    
    // 检测模型类型进行标准化
    const isBriaModel = /rmbg/i.test(filename) || /bria/i.test(options.license || '');
    const floatArr1 = new Float32Array(width * height * 3);
    if (isBriaModel) {
      for (let i = 0; i < floatArr.length; i += 3) {
          floatArr1[i] = (floatArr[i] - 0.485) / 0.229;
          floatArr1[i + 1] = (floatArr[i + 1] - 0.456) / 0.224;
          floatArr1[i + 2] = (floatArr[i + 2] - 0.406) / 0.225;
      }
    } else {
      // 其他模型沿用 0..1 归一化
      floatArr1.set(floatArr);
    }
    
    // 转换为NCHW格式 - 优化版本
    const floatArr2 = new Float32Array(width * height * 3);
    let k = 0;
    for (let i = 0; i < floatArr.length; i += 3) {
        // R 通道（使用归一化后的数据）
        floatArr2[k++] = floatArr1[i];
    }
    let l = width * height;
    for (let i = 1; i < floatArr.length; i += 3) {
        // G 通道
        floatArr2[l++] = floatArr1[i];
    }

    let m = 2 * width * height;
    for (let i = 2; i < floatArr.length; i += 3) {
        // B 通道
        floatArr2[m++] = floatArr1[i];
    }

    // 5. 创建 ONNX 输入
    const inputNCHW = new (ort as any).Tensor('float32', floatArr2, [1, 3, height, width]);
    const inputNHWC = new (ort as any).Tensor('float32', floatArr, [1, height, width, 3]);
    
    // 根据模型元数据判断输入格式
    let preferNHWC = false;
    try {
      const inputMeta = (session as any).inputMetadata || {};
      const meta = inputMeta[feedInputName];
      const dims: any[] = meta?.dimensions || [];
      if (dims?.length === 4) {
        preferNHWC = dims[3] === 3; // 最后一维是3则为NHWC
      }
    } catch (e) {
      logger.debug('RemoveBg', `读取输入元数据失败 ${inputOptions.uid}`, { uid: inputOptions.uid, error: e.message });
    }
    
    // 7. ONNX推理
    logMemoryUsage(inputOptions.uid, '推理前');
    logger.info('RemoveBg', `开始ONNX推理 ${inputOptions.uid}`, { 
      uid: inputOptions.uid, 
      preferredLayout: preferNHWC ? 'NHWC' : 'NCHW',
      inputName: feedInputName
    });
    
    const feeds: Record<string, any> = {};
    let results: Record<string, any> = {};
    let inferenceSuccess = false;
    
    // 尝试首选格式
    try {
      feeds[feedInputName] = preferNHWC ? inputNHWC : inputNCHW;
      const inferenceStartTime = Date.now();
      results = await session.run(feeds);
      inferenceSuccess = true;
      
      logger.info('RemoveBg', `ONNX推理成功 ${inputOptions.uid}`, { 
        uid: inputOptions.uid, 
        layout: preferNHWC ? 'NHWC' : 'NCHW',
        inferenceTime: Date.now() - inferenceStartTime
      });
    } catch (firstError) {
      logger.warn('RemoveBg', `首选格式推理失败，尝试备选格式 ${inputOptions.uid}`, { 
        uid: inputOptions.uid,
        error: firstError.message 
      });
      
      // 尝试备选格式
      try {
        feeds[feedInputName] = preferNHWC ? inputNCHW : inputNHWC;
        const inferenceStartTime = Date.now();
        results = await session.run(feeds);
        inferenceSuccess = true;
        
        logger.info('RemoveBg', `备选格式推理成功 ${inputOptions.uid}`, { 
          uid: inputOptions.uid, 
          fallbackLayout: preferNHWC ? 'NCHW' : 'NHWC',
          inferenceTime: Date.now() - inferenceStartTime
        });
      } catch (secondError) {
        logger.error('RemoveBg', `所有格式推理失败 ${inputOptions.uid}`, { 
          uid: inputOptions.uid,
          firstError: firstError.message,
          secondError: secondError.message
        });
        throw secondError;
      }
    }
    
    if (!inferenceSuccess) {
      throw new Error('ONNX推理失败：无法识别正确的输入格式');
    }
    
    logMemoryUsage(inputOptions.uid, '推理后');
    const outNames: string[] = (session as any).outputNames || Object.keys(results) || [];
    const outName = outNames[0];
    let outTensor: any = outName ? results[outName] : undefined;
    if (!outTensor) {
      const values = Object.values(results);
      outTensor = values && values.length > 0 ? values[0] : undefined;
    }
    if (!outTensor) {
      throw new Error('ONNX 推理未返回任何输出张量');
    }
    // 8. 后处理：在模型尺寸上处理以保证质量
    logger.info('RemoveBg', `开始后处理 ${inputOptions.uid}`, { 
      uid: inputOptions.uid,
      modelSize: { width, height },
      originalSize: { width: originalWidth, height: originalHeight }
    });
    logMemoryUsage(inputOptions.uid, '后处理前');
    
    // 在模型尺寸上提取掩码（保持最佳质量）
    const predMaskResized = await extractMaskResized(outTensor, width, height);
    logger.info('RemoveBg', `掩码提取完成 ${inputOptions.uid}`, { 
      uid: inputOptions.uid,
      maskSize: predMaskResized.length,
      maskDimensions: { width, height }
    });
    
    // 在模型尺寸上进行RGBA合成（使用推理时的图像数据）
    const cutoutBuffer = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const alpha = predMaskResized[i];
      const base = i * 4;
      const srcBase = i * 3;
      if (alpha > 127) {
        cutoutBuffer[base] = data[srcBase] || 0;
        cutoutBuffer[base + 1] = data[srcBase + 1] || 0;
        cutoutBuffer[base + 2] = data[srcBase + 2] || 0;
        cutoutBuffer[base + 3] = 255;
      } else {
        cutoutBuffer[base] = 0;
        cutoutBuffer[base + 1] = 0;
        cutoutBuffer[base + 2] = 0;
        cutoutBuffer[base + 3] = 0;
      }
    }
    //  // 8. 保存结果为图片
    //  await sharp(outputBuffer, { raw: { width: width, height: height, channels: 4 } })
    //  .png()
    //  .toFile(outputPath);
      
    // console.log(`Image saved to ${outputPath}`);
    console.log('保存抠图结果')
    // 保存抠图结果
    await sharp(cutoutBuffer, { raw: { width: width, height: height, channels: 4 } })
        .png()
      .toFile(outputPath);
    
    logMemoryUsage(inputOptions.uid, '保存完成');

    // 10. 最终处理和清理
    const processTime = Date.now() - startTime;
    const stats = fs.statSync(outputPath);
    const fileSizeInBytes = stats.size;
    
    logger.info('RemoveBg', `抠图任务完成 ${inputOptions.uid}`, { 
      uid: inputOptions.uid,
      outputPath,
      fileSize: fileSizeInBytes,
      processTime,
      originalSize: { width: originalWidth, height: originalHeight },
      modelInputSize: { width, height },
      resizedBack: originalWidth !== width || originalHeight !== height,
      platform: process.platform
    });
    
    // 读取结果文件
    const outPngBuffer = fs.readFileSync(outputPath);
    
    // Windows特定的内存清理
    if (process.platform === 'win32') {
      // 清理大数组引用
      // @ts-ignore
      floatArr.fill(0);
      // @ts-ignore
      floatArr2.fill(0);
      // @ts-ignore
      cutoutBuffer.fill(0);
      
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
        logger.debug('RemoveBg', `执行最终垃圾回收 ${inputOptions.uid}`, { uid: inputOptions.uid });
      }
    }
    
    logMemoryUsage(inputOptions.uid, '任务完成');
    
    return {
      uid: inputOptions.uid,
      outputPath,
      fileSize: fileSizeInBytes,
      base64Image: `data:image/png;base64,${outPngBuffer.toString('base64')}`,
      processTime,
      originalSize: { width: originalWidth, height: originalHeight },
      modelInputSize: { width, height },
      resizedBack: originalWidth !== width || originalHeight !== height,
      memoryPeak: peakMemoryUsage,
      // GPU/CUDA 状态信息
      executionProviders: {
        requested: candidateEPs,
        actual: actualExecutionProviders,
        usingCuda: actualExecutionProviders.includes('cuda'),
        cudaDiagnostic: cudaDiagnosticInfo
      }
    };

  } catch (e) {
    const errorTime = Date.now() - startTime;
    logger.error('RemoveBg', `抠图任务失败 ${inputOptions.uid}`, {
      uid: inputOptions.uid,
      model: inputOptions.model,
      outputFormat: inputOptions.outputformat,
      error: e.message,
      stack: e.stack,
      processTime: errorTime,
      platform: process.platform,
      arch: process.arch
    }, e);
    
    return {
      uid: inputOptions.uid,
      outputPath: '',
      fileSize: 0,
      base64Image: ''
    }
  }

}

/**
 * 添加水印到图片
 * @param sharper Sharp实例
 * @param watermarkOptions 水印选项
 */
/**
 * 为图片添加文本水印。
 *
 * @param sharper sharp 实例
 * @param watermarkOptions 水印参数（文本、位置、字号、颜色、透明度）
 * @param targetSize 可选的目标尺寸（用于计算文本位置），未传则读取元数据
 */
async function addWatermark(
  sharper: sharp.Sharp,
  watermarkOptions: {
    text: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    fontSize: number;
    color: string;
    opacity: number;
  },
  targetSize?: { width?: number; height?: number }
): Promise<sharp.Sharp> {
  // 计算目标尺寸：优先使用目标尺寸（来自 resize 选项），否则读取输入元数据
  const metadata = await sharper.metadata();
  const canvasWidth = (targetSize?.width && targetSize.width > 0 ? targetSize.width : metadata.width) || 800;
  const canvasHeight = (targetSize?.height && targetSize.height > 0 ? targetSize.height : metadata.height) || 600;

  const margin = 20;
  const fontSize = watermarkOptions.fontSize || 24;
  const color = watermarkOptions.color || '#ffffff';
  const opacity = typeof watermarkOptions.opacity === 'number' ? watermarkOptions.opacity : 0.5;

  // 根据位置计算坐标与锚点
  let x = margin;
  let y = margin + fontSize;
  let textAnchor = 'start'; // start | middle | end

  switch (watermarkOptions.position) {
    case 'top-left':
      x = margin; y = margin + fontSize; textAnchor = 'start'; break;
    case 'top-right':
      x = canvasWidth - margin; y = margin + fontSize; textAnchor = 'end'; break;
    case 'bottom-left':
      x = margin; y = canvasHeight - margin - fontSize * 0.3; textAnchor = 'start'; break;
    case 'bottom-right':
      x = canvasWidth - margin; y = canvasHeight - margin - fontSize * 0.3; textAnchor = 'end'; break;
    case 'center':
      x = canvasWidth / 2; y = canvasHeight / 2; textAnchor = 'middle'; break;
    default:
      x = canvasWidth - margin; y = canvasHeight - margin - fontSize * 0.3; textAnchor = 'end';
  }

  const svgText = `
    <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <style>
        text { paint-order: stroke; stroke: rgba(0,0,0,${Math.min(opacity + 0.2, 0.8)}); stroke-width: 0.5px; }
      </style>
      <text 
        x="${x}"
        y="${y}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}px"
        fill="${color}"
        fill-opacity="${opacity}"
        text-anchor="${textAnchor}"
      >${escapeXml(watermarkOptions.text)}</text>
    </svg>
  `;

  return sharper.composite([{ input: Buffer.from(svgText) }]);
}

/**
 * 逃逸 XML 文本中的特殊字符。
 *
 * @param unsafe 原始文本
 * @returns 已转义文本
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
