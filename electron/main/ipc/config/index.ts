import { app, ipcMain, nativeTheme } from "electron";
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
export interface ModelOptionItem {
    width: number;
    height: number;
    size: string;
    license: string;
    homepage: string;
    md5: string;
    feedInput: string;
    downloaded?: boolean;
}

export interface ModelOption {
    [key: string]: ModelOptionItem
}

export interface AppOptions {
    modelDir: string;
    outputDir: string;
    language:  string;
    theme:  string;
    models: ModelOption;
}

// 支持的模型配置信息
export const MODEL_OPTION: ModelOption = {
    'rmbg-1.4.onnx': {
        width: 1024,
        height: 1024,
        size: '176MB',
        license: 'bria-rmbg-1.4',
        homepage: 'https://github.com/danielgatis/rembg',
        md5: '8bb9b16ff49cda31e7784852873cfd0d', 
        feedInput: 'input'
    },
    'u2net.onnx': {
        width: 320,
        height: 320,
        size: '176MB',
        license: 'MIT',
        homepage: 'https://github.com/danielgatis/rembg',
        md5: '60024c5c889badc19c04ad937298a77b',
        feedInput: 'input.1'
    },
    'u2net_human_seg.onnx': {
        width: 320,
        height: 320,
        size: '176MB',
        license: 'MIT',
        homepage: 'https://github.com/danielgatis/rembg',
        md5: 'c09ddc2e0104f800e3e1bb4652583d1f',
        feedInput: 'input.1'
    },
    'u2net_cloth_seg.onnx': {
        width: 320,
        height: 320,
        size: '176MB',
        license: 'MIT',
        homepage: 'https://github.com/danielgatis/rembg',
        md5: '2434d1f3cb744e0e49386c906e5a08bb',
        feedInput: 'input.1'
    },
    'silueta.onnx': {
        width: 320,
        height: 320,
        size: '44.2MB',
        license: 'MIT',
        homepage: 'https://github.com/danielgatis/rembg',
        md5: '55e59e0d8062d2f5d013f4725ee84782',
        feedInput: 'input.1'
    },
    'BEN2_Base.onnx': {
        width: 1024,
        height: 1024,
        size: '222.9MB',
        license: 'MIT',
        homepage: 'https://github.com/PramaLLC/BEN2/',
        md5: 'a12dafe4080f53e8818726b298bd90bc',
        feedInput: 'input.1'
    },
    'isnet-general-use.onnx': {
        width: 1024,
        height: 1024,
        size: '178.6MB',
        license: 'MIT',
        homepage: 'https://github.com/danielgatis/rembg',
        md5: '80bb0d6616a2085b2f264913e01fafa2',
        feedInput: 'input_image'
    }
}

// 初始化配置文件
export function setupConfig() {
    const userDataPath = app.getPath("userData");
    const configPath = path.join(userDataPath, "config.json");
    const modelDir = path.join(userDataPath, '/model');
    // 检查目录是否存在，不存在则创建
    if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
        console.log(`创建模型目录: ${modelDir}`);
    }
    // 默认配置
    const defaultConfig = {
        modelDir,
        outputDir: app.getPath("downloads"), // 使用用户的下载目录
        language: "zh",
        theme: "auto",
        models: MODEL_OPTION
    };

    // 检查配置文件是否存在
    if (!fs.existsSync(configPath)) {
        // 创建配置文件
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log("配置文件已创建:", configPath);
    } else {
        console.log("配置文件已存在:", configPath);
    }

    return configPath;
}

export async function getConfig(): Promise<{
    success: boolean;
    data: AppOptions | null;
    error: null | Error;
    path: string;
}> {
    const configPath = setupConfig();
    try {
        const config = fs.readFileSync(configPath, 'utf-8');
        const options: AppOptions = JSON.parse(config)
        // 检查模型是否已经下载到 options.modelDir
        if (options.models) {
            const modelNames = Object.keys(options.models);
            // 并发校验各模型文件
            await Promise.all(modelNames.map(async (model) => {
                const modelFilePath = path.join(options.modelDir, model);
                const exists = fs.existsSync(modelFilePath);
                console.log(`模型[${model}]${exists ? '已下载' : '未下载'}: ${modelFilePath}`);
                if (!exists) {
                    options.models[model].downloaded = false;
                    return;
                }
                const expectedMd5 = options.models[model].md5;
                const sidecarPath = `${modelFilePath}.md5`;

                // 优先使用侧车 md5 文件以加速启动
                if (fs.existsSync(sidecarPath)) {
                    try {
                        const sidecarMd5 = fs.readFileSync(sidecarPath, 'utf-8').trim();
                        if (sidecarMd5 === expectedMd5) {
                            options.models[model].downloaded = true;
                            console.log(`模型[${model}]md5一致(侧车): ${modelFilePath}`);
                            return;
                        }
                    } catch (_) {
                        // 侧车读取失败则回退到流式计算
                    }
                }

                // 流式计算 md5，避免一次性读取大文件
                const actualMd5 = await md5OfFile(modelFilePath);
                const isMatch = actualMd5 === expectedMd5;
                options.models[model].downloaded = isMatch;
                // 更新侧车 md5 文件，方便下次快速校验
                try {
                    fs.writeFileSync(sidecarPath, actualMd5, 'utf-8');
                } catch (_) { /* 忽略写入错误 */ }
                console.log(actualMd5, expectedMd5);
                console.log(`模型[${model}]md5${isMatch ? '一致' : '不2一致'}: ${modelFilePath}`);
            }));
        }
        return {
            success: true,
            data: options,
            path: configPath,
            error: null,
        }
    } catch (e) {
        return {
            error: e as Error,
            data: null,
            path: configPath,
            success: false,
        };
    }
}

function md5OfFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const hash = crypto.createHash('md5');
            const stream = fs.createReadStream(filePath);
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('error', (err) => reject(err));
            stream.on('end', () => resolve(hash.digest('hex')));
        } catch (err) {
            reject(err);
        }
    });
}

// 更新配置
export async function updateConfig (options: Partial<AppOptions>):  Promise<{
    success: boolean;
    data: AppOptions | null;
    error: null | Error;
}> {
    try {
        const res = await getConfig()
        if (!res.success) {
            return {
                success: false,
                data: null,
                error: res.error
            }
        } else {

            const localOptions = res.data;
            const mergeOptions = Object.assign(localOptions, options)
            // 写入本地
            fs.writeFileSync(res.path, JSON.stringify(mergeOptions, null, 2));
            return {
                success: true,
                data: mergeOptions,
                error: null
            }
        }
    } catch (e) {
        return {
            error: e,
            data: null,
            success: false
        }
    }
}

export function getModelOption(modelName: string): ModelOptionItem {
    const option = MODEL_OPTION[modelName];
    if (!option) {
        return {
            width: 320,
            height: 320,
            size: 'unkown',
            license: 'unkown',
            md5: 'unkown',
            homepage: '',
            feedInput: 'input.1'
        }; // 默认返回 u2net 的配置
    }
    return option;
}

// 更新系统原生主题设置
export function setupNativeTheme() {
  ipcMain.handle('setNativeTheme', (_event, theme: 'dark' | 'light' | 'system') => {
    if (theme === 'dark') {
      nativeTheme.themeSource = 'dark';
    } else if (theme === 'light') {
      nativeTheme.themeSource = 'light';
    } else {
      nativeTheme.themeSource = 'system';
    }
    
    return {
      success: true,
      currentTheme: nativeTheme.themeSource,
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors
    };
  });
  
  // 获取当前原生主题设置
  ipcMain.handle('getNativeTheme', () => {
    return {
      themeSource: nativeTheme.themeSource,
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors
    };
  });
}