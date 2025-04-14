import { ipcMain } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import sharp from 'sharp';
import * as png2icns from 'png2icons';

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