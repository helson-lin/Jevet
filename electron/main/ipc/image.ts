import { ipcMain } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import sharp from 'sharp';
import * as png2icns from 'png2icons';
// 延迟加载 onnxruntime-node，避免打包期处理原生绑定
import { MODEL_OPTION, type ModelOptionItem, getConfig } from './config/index'

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
function getModelOption (modelName): ModelOptionItem {
  if (MODEL_OPTION[modelName]) {
      return MODEL_OPTION[modelName]
  } else {
      return {
          width: 320,
          height: 320,
          size: 'unkown',
          license: 'unkown',
          md5: 'unkown',
          homepage: 'unkown',
          feedInput: 'input.1'
      }
  }
}

// 实现抠图
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
    const ort = await import('onnxruntime-node');
    const session = await (ort as any).InferenceSession.create(modelPath);
    console.log("模型加载完成");
    // 获取模型的名称
    const filename = path.basename(modelPath);
    // 通过模型的名称获取模型的配置信息
    const options = getModelOption(filename);
    
    // 2. 读取图像并调整大小，确保转换为RGB格式
    const imageBuffer = await sharp(inputBuffer)
      .resize(options.width, options.height)
      .removeAlpha()  // 移除 alpha 通道
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    const { data, info } = imageBuffer;
    const { width, height, channels } = info;

    // 3. 检查通道数
    if (channels !== 3) {
        console.warn(`Warning: Expected 3 channels (RGB), but got ${channels}. Attempting to continue...`);
    }

    // 4. 预处理图像数据
    const floatArr = new Float32Array(width * height * 3);
    let j = 0;
    for (let i = 0; i < data.length; i++) {
        floatArr[j++] = data[i] / 255;
    }

    const floatArr1 = new Float32Array(width * height * 3);
    for (let i = 0; i < floatArr.length; i += 3) {
        floatArr1[i] = (floatArr[i] - 0.485) / 0.229;
        floatArr1[i + 1] = (floatArr[i + 1] - 0.456) / 0.224;
        floatArr1[i + 2] = (floatArr[i + 2] - 0.406) / 0.225;
    }

    const floatArr2 = new Float32Array(width * height * 3);
    let k = 0;
    for (let i = 0; i < floatArr.length; i += 3) {
        floatArr2[k++] = floatArr[i];
    }

    let l = width * height;
    for (let i = 1; i < floatArr.length; i += 3) {
        floatArr2[l++] = floatArr[i];
    }

    let m = 2 * width * height;
    for (let i = 2; i < floatArr.length; i += 3) {
        floatArr2[m++] = floatArr[i];
    }

    // 5. 创建 ONNX 输入
    const input = new ort.Tensor('float32', floatArr2, [1, 3, width, height]);
    const feeds = { };
    feeds[options.feedInput] = input
    // 6. 运行 ONNX 模型
    const results = await session.run(feeds);
    const pred: any = results[session.outputNames[0]].data;

    // 7. 后处理结果
    const outputBuffer = new Uint8Array(width * height * 4); // RGBA，用于输出灰度图
    const cutoutBuffer = new Uint8Array(width * height * 4); // RGBA，用于抠图结果

    for (let i = 0; i < pred.length; i++) {
        const value = Math.round(pred[i] * 255); // 将预测值缩放到 0-255 范围
        const index = i * 4;

        // 创建灰度图
        outputBuffer[index] = value;       // R
        outputBuffer[index + 1] = value;   // G
        outputBuffer[index + 2] = value;   // B
        outputBuffer[index + 3] = 255;     // A

        // 创建抠图结果
        // 如果预测值大于某个阈值，则认为是前景，保留原始颜色，否则设为透明
        const threshold = 128;  // 可以根据需要调整阈值
        if (value > threshold) {
            cutoutBuffer[index] = data[i * 3];         // R
            cutoutBuffer[index + 1] = data[i * 3 + 1];     // G
            cutoutBuffer[index + 2] = data[i * 3 + 2];     // B
            cutoutBuffer[index + 3] = 255;             // A (不透明)
        } else {
            cutoutBuffer[index] = 0;         // R
            cutoutBuffer[index + 1] = 0;     // G
            cutoutBuffer[index + 2] = 0;     // B
            cutoutBuffer[index + 3] = 0;     // A (透明)
        }
    }
    //  // 8. 保存结果为图片
    //  await sharp(outputBuffer, { raw: { width: width, height: height, channels: 4 } })
    //  .png()
    //  .toFile(outputPath);

    // console.log(`Image saved to ${outputPath}`);

    // 保存抠图结果
    await sharp(cutoutBuffer, { raw: { width: width, height: height, channels: 4 } })
        .png()
        .toFile(outputPath);

    console.log(`Cutout image saved to ${outputPath}`);

    // 获取文件大小
    const stats = fs.statSync(outputPath);
    const fileSizeInBytes = stats.size;
    return {
      uid: inputOptions.uid,
      outputPath,
      fileSize: fileSizeInBytes,
      base64Image: `data:image/png;base64,${cutoutBuffer.toString()}`,
    }

  } catch (e) {
    console.warn(e)
  }

}

/**
 * 添加水印到图片
 * @param sharper Sharp实例
 * @param watermarkOptions 水印选项
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

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
