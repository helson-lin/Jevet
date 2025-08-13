import { ipcMain } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as png2icns from 'png2icons';
// 延迟加载 onnxruntime-node，避免打包期处理原生绑定
import { MODEL_OPTION, type ModelOptionItem, getConfig } from './config/index'

// ES 模块兼容的 __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  //  实现图片转码
  ipcMain.handle("compress", async (_, arg: { imgs: IMG_ITEM[]; options?: ImageProcessOptions }) => {
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

      return {
        success: true,
        results,
        message: `成功并行处理了${results.length}张图片`,
      };
    } catch (e) {
      console.error("Image processing error:", e);
      return { success: false, error: e.message };
    }
  });

  // Register the remove handler here
  ipcMain.handle('remove', async (_, arg: { imgs: IMG_ITEM[], options: {
    model: string,
    quality: number,
    outputformat: string,
  }}) => {
    try {
      const imgs = arg.imgs;
      const processingPromises = imgs.map(async (imgItem) => await removeBg(imgItem.buffer as any, { outputformat: arg.options?.outputformat, model: arg.options?.model, uid: imgItem.uid }))
      const results = await Promise.all(processingPromises);

      return {
        success: true,
        results,
        message: `成功并行处理了${results.length}张图片`,
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
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
  try {
    // 临时文件目录
    const tempDir = os.tmpdir();
    // 输出文件的格式
    let outputPath = path.join(
      tempDir,
      `removebg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${inputOptions.outputformat}`
    );
    // 1. 加载 ONNX 模型
    const config = await getConfig();
    const modelDir = config.data.modelDir;
    const modelDirPath = modelDir || path.join(process.cwd(), 'model');
    const modelPath = path.join(modelDirPath, `${inputOptions.model || 'u2net'}.onnx`);
    // 动态加载 onnxruntime-node，增加 Windows 兼容性
    let ort;
    try {
      ort = await import('onnxruntime-node');
    } catch (firstError) {
      console.warn('First attempt to load onnxruntime-node failed:', firstError.message);
      
      // 在 Windows 上尝试手动设置模块路径
      if (process.platform === 'win32') {
        const isDev = !!process.env.VITE_DEV_SERVER_URL;
        const possibleModulePaths = [];
        
        if (isDev) {
          // 开发环境路径
          possibleModulePaths.push(
            path.join(process.cwd(), 'node_modules/onnxruntime-node'),
            path.join(__dirname, '../../../node_modules/onnxruntime-node')
          );
        } else {
          // 生产环境路径 - 打包后的 ASAR unpack 路径
          const resourcesPath = process.resourcesPath;
          possibleModulePaths.push(
            path.join(resourcesPath, 'app.asar.unpacked/node_modules/onnxruntime-node'),
            path.join(resourcesPath, 'node_modules/onnxruntime-node'),
            path.join(process.cwd(), 'node_modules/onnxruntime-node')
          );
        }
        
        let loaded = false;
        for (const modulePath of possibleModulePaths) {
          try {
            console.log('Trying to load onnxruntime-node from:', modulePath);
            // 先检查模块是否存在
            const moduleIndexPath = path.join(modulePath, 'dist/index.js');
            if (fs.existsSync(moduleIndexPath)) {
              ort = await require(modulePath);
              loaded = true;
              console.log('Successfully loaded onnxruntime-node from:', modulePath);
              break;
            }
          } catch (e) {
            console.warn('Failed to load from:', modulePath, e.message);
          }
        }
        
        if (!loaded) {
          const errorMsg = [
            'Failed to load onnxruntime-node. This is likely due to missing native binaries.',
            'Please try the following steps to fix this issue:',
            '1. Run: npm run check:ort (to diagnose the issue)',
            '2. Run: npm run fix:ort (to completely reinstall onnxruntime-node)',
            '3. Run: npm run setup:win (to rebuild native modules)',
            '4. If still failing, you may need to install Visual Studio Build Tools',
            '',
            'Searched paths:',
            ...possibleModulePaths.map(p => `  - ${p}`)
          ].join('\n');
          throw new Error(errorMsg);
        }
      } else {
        throw firstError;
      }
    }
    let session: any;
    // 根据平台与配置选择 EP：Win/Linux 且 useGPU=true 时优先 CUDA，否则 CPU
    const allowGPU = Boolean(config?.data?.useGPU);
    const candidateEPs = (process.platform === 'win32' || process.platform === 'linux') && allowGPU
      ? ['cuda', 'cpu']
      : ['cpu'];
    try {
      // 构建 ONNX Runtime 会话参数
      // executionProviders: 推理执行后端，优先使用 CUDA（如可用），否则回退到 CPU
      // graphOptimizationLevel: 图优化等级，'basic' 表示基础优化
      // intraOpNumThreads: 单个操作的线程数
      // interOpNumThreads: 操作间的线程数
      // enableCpuMemArena: 是否启用 CPU 内存池（此处关闭以减少内存占用）
      // enableMemPattern: 是否启用内存模式优化（此处关闭以兼容性优先）
      // logSeverityLevel: 日志级别，0 表示最详细
      const sessionOptions: any = {
        executionProviders: candidateEPs,
        graphOptimizationLevel: (config?.data?.graphOptimizationLevel || 'basic'),
        intraOpNumThreads: 3,
        interOpNumThreads: 3,
        enableCpuMemArena: false,
        enableMemPattern: false,
        logSeverityLevel: 0
      };
      console.log('创建 ORT 会话', sessionOptions);
      session = await (ort as any).InferenceSession.create(modelPath, sessionOptions);
    } catch (err) {
      console.log('创建 ORT 会话失败，尝试使用最小配置回退', err);
      session = await (ort as any).InferenceSession.create(modelPath, { executionProviders: ['cpu'] });
    }
    // 获取模型的名称
    const filename = path.basename(modelPath);
    // 通过模型的名称获取模型的配置信息
    const options = getModelOption(filename);
    console.log("模型加载完成", filename, options, {
      executionProviders: candidateEPs,
      graphOptimizationLevel: (config?.data?.graphOptimizationLevel || 'basic'),
      intraOpNumThreads: 3,
      interOpNumThreads: 3,
      enableCpuMemArena: false,
      enableMemPattern: false,
      logSeverityLevel: 0
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
      console.warn('读取模型输入元数据失败，使用默认配置', e);
    }
    console.log('读取图像并调整大小，确保转换为RGB格式', options.width, options.height);
    // 2. 读取图像并调整大小，确保转换为RGB格式
    const targetW = options.width && options.width > 0 ? options.width : (filename.toLowerCase().includes('ben2') ? 1024 : 320);
    const targetH = options.height && options.height > 0 ? options.height : (filename.toLowerCase().includes('ben2') ? 1024 : 320);
    const imageBuffer = await sharp(inputBuffer)
      .resize(targetW, targetH)
      .removeAlpha()  // 移除 alpha 通道
      .toColorspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    const { data, info } = imageBuffer;
    const { width, height, channels } = info;
    console.log('检查通道数')

    // 3. 检查通道数
    if (channels !== 3) {
        console.warn(`Warning: Expected 3 channels (RGB), but got ${channels}. Attempting to continue...`);
    }
    console.log('预处理图像数据')
    // 4. 预处理图像数据
    const floatArr = new Float32Array(width * height * 3);
    let j = 0;
    for (let i = 0; i < data.length; i++) {
        floatArr[j++] = data[i] / 255;
    }
    console.log('预处理图像数据1')
    // 仅在 bria/rmbg 模型时进行 mean/std 标准化，避免影响其他模型
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
    console.log('预处理图像数据2', isBriaModel)
    const floatArr2 = new Float32Array(width * height * 3);
    let k = 0;
    for (let i = 0; i < floatArr.length; i += 3) {
        // R 通道（使用归一化后的数据）
        floatArr2[k++] = floatArr1[i];
    }
    console.log('预处理图像数据3')
    let l = width * height;
    for (let i = 1; i < floatArr.length; i += 3) {
        // G 通道
        floatArr2[l++] = floatArr1[i];
    }
    console.log('预处理图像数据4')
    let m = 2 * width * height;
    for (let i = 2; i < floatArr.length; i += 3) {
        // B 通道
        floatArr2[m++] = floatArr1[i];
    }
    console.log('创建 ONNX 输入')
    // 5. 创建 ONNX 输入
    const inputNCHW = new (ort as any).Tensor('float32', floatArr2, [1, 3, height, width]);
    const inputNHWC = new (ort as any).Tensor('float32', floatArr1, [1, height, width, 3]);
    const feeds: Record<string, any> = {};
    // 根据模型元数据尝试判断布局
    let preferNHWC = false;
    try {
      const inputMeta = (session as any).inputMetadata || {};
      const meta = inputMeta[feedInputName];
      const dims: any[] = meta?.dimensions || [];
      if (dims?.length === 4) {
        // 如果最后一维是 3，判定为 NHWC
        preferNHWC = dims[3] === 3;
      }
    } catch (_) { /* 忽略 */ }
    let results: Record<string, any> = {};
    try {
      feeds[feedInputName] = preferNHWC ? inputNHWC : inputNCHW;
      console.log('运行 ONNX 模型，布局=', preferNHWC ? 'NHWC' : 'NCHW');
      results = await session.run(feeds);
    } catch (errFirst) {
      console.warn('首次运行失败，尝试切换布局重试', errFirst);
      try {
        feeds[feedInputName] = preferNHWC ? inputNCHW : inputNHWC;
        console.log('运行 ONNX 模型（回退），布局=', preferNHWC ? 'NCHW' : 'NHWC');
        results = await session.run(feeds);
      } catch (errSecond) {
        throw errSecond;
      }
    }
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
    const predMaskResized = await extractMaskResized(outTensor, width, height);
    console.log('后处理结果')
    // 7. 后处理结果（根据 mask 合成 RGBA）
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

    console.log(`Cutout image saved to ${outputPath}`);

    // 获取文件大小和 base64
    const stats = fs.statSync(outputPath);
    const fileSizeInBytes = stats.size;
    const outPngBuffer = fs.readFileSync(outputPath);
    return {
      uid: inputOptions.uid,
      outputPath,
      fileSize: fileSizeInBytes,
      base64Image: `data:image/png;base64,${outPngBuffer.toString('base64')}`,
    }

  } catch (e) {
    console.error('removeBg error:', e)
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
