import { ipcMain } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import sharp from 'sharp';
import * as png2icns from 'png2icons';
import * as ort from 'onnxruntime-node'
import { processBEN2 } from './ben2';

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
}

export function setupImageHandlers() {
  ipcMain.handle("pi", async (_, arg: { imgs: IMG_ITEM[]; options?: ImageProcessOptions }) => {
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
          const width = options.width || options.height;
          const height = options.width || options.height;
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


async function removeBg(inputBuffer: Buffer, options: {
  outputformat: string;
  model: string;
  uid: string;
}, modelPath = path.join(process.cwd(), 'model/u2net.onnx')) {
  const tempDir = os.tmpdir();
  let outputPath = path.join(
    tempDir,
    `removebg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${options.outputformat}`
  );
    // 1. 加载 ONNX 模型
    const session = await ort.InferenceSession.create(path.join(process.cwd(), `model/${options.model}.onnx`) ?? modelPath, {
        executionProviders: [
            'cuda', // 优先用 GPU
            'cpu'   // 如果 GPU 不可用，回退到 CPU
        ]
    });
    let outputBuffer, width, height;
    if (options.model === 'BEN2_Base') {
      const data = await processBEN2(inputBuffer, session)
      outputBuffer = data.buffer
      width = data.height
      height = data.height
    } else {
      // 2. 预处理图像（resize + normalize）
      const { data } = await sharp(inputBuffer)
          .resize(320, 320)  // 必须和模型输入尺寸一致！
          .raw()
          .toBuffer({ resolveWithObject: true });
  
      // 转换为 [N,C,H,W] 格式的归一化 Float32Array
      const inputData = new Float32Array(3 * 320 * 320);
      for (let i = 0; i < data.length; i += 4) { // RGBA 格式
          const pixel = i / 4;
          inputData[pixel] = (data[i] / 255 - 0.485) / 0.229;     // R (ImageNet Norm)
          inputData[pixel + 320 * 320] = (data[i + 1] / 255 - 0.456) / 0.224; // G
          inputData[pixel + 2 * 320 * 320] = (data[i + 2] / 255 - 0.406) / 0.225; // B
      }
  
      // 3. 创建 ONNX 张量输入
      const tensor = new ort.Tensor('float32', inputData, [1, 3, 320, 320]);
      const feeds = { [session.inputNames[0]]: tensor };
  
      // 4. 运行推理
      const results = await session.run(feeds);
      const maskData = results[session.outputNames[0]].data; // 获取输出张量
      // 5. 生成 Alpha 掩码（0-255）
      const alphaMask = new Uint8Array(Array.from(maskData as Float32Array).map((v: number) => v > 0.5 ? 255 : 0));
  
      // 6. 应用掩码至原图（生成透明 PNG）
      const original = await sharp(inputBuffer)
          .ensureAlpha() // 添加 Alpha 通道
          .raw()
          .toBuffer({ resolveWithObject: true });
  
      outputBuffer = Buffer.alloc(original.data.length);
      width = original.info.width
      height =  original.info.height
      for (let i = 0; i < original.data.length; i += 4) {
          const x = Math.floor((i / 4) % original.info.width * (320 / original.info.width));
          const y = Math.floor((i / 4 / original.info.width) * (320 / original.info.height));
          const maskValue = alphaMask[y * 320 + x];
  
          outputBuffer[i] = original.data[i];     // R
          outputBuffer[i + 1] = original.data[i + 1]; // G
          outputBuffer[i + 2] = original.data[i + 2]; // B
          outputBuffer[i + 3] = maskValue;       // A (0=透明, 255=不透明)
      }
      // 7. 保存原始大小的图片
      await sharp(outputBuffer, {
          raw: {
              width,
              height,
              channels: 4
          }
      })
      .toFormat(options.outputformat as keyof sharp.FormatEnum)
      .toFile(outputPath);
    }

    // 生成一个较小的预览图
    const previewBuffer = await sharp(outputBuffer, {
        raw: {
            width,
            height,
            channels: 4
        }
    })
    .resize(800, 800, {
        fit: 'inside',  // 保持宽高比
        withoutEnlargement: true  // 如果图片小于800px则不放大
    })
    .toFormat(options.outputformat as keyof sharp.FormatEnum)
    .toBuffer();

    // 获取文件大小
    const stats = fs.statSync(outputPath);
    const fileSizeInBytes = stats.size;

    // 为了进一步减小base64大小，对于预览可以使用webp格式
    const previewBase64 = await sharp(previewBuffer)
        .toFormat('webp', { quality: 80 })
        .toBuffer();

    return {
        uid: options.uid,
        outputPath,
        fileSize: fileSizeInBytes,
        base64Image: `data:image/webp;base64,${previewBase64.toString('base64')}`,
    };
}
