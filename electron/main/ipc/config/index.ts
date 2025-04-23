import { app } from "electron";
import path from 'node:path';
import fs from 'node:fs';
export interface ModelOptionItem {
    width: number;
    height: number;
    size: string;
    license: string;
    homepage: string;
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
        feedInput: 'input'
    },
    'u2net.onnx': {
        width: 320,
        height: 320,
        size: '176MB',
        license: 'MIT',
        homepage: 'https://github.com/danielgatis/rembg',
        feedInput: 'input.1'
    },
    'u2net_human_seg.onnx': {
        width: 320,
        height: 320,
        size: '176MB',
        license: 'MIT',
        homepage: 'https://github.com/danielgatis/rembg',
        feedInput: 'input.1'
    },
    'u2net_cloth_seg.onnx': {
        width: 320,
        height: 320,
        size: '176MB',
        license: 'MIT',
        homepage: 'https://github.com/danielgatis/rembg',
        feedInput: 'input.1'
    },
    'silueta.onnx': {
        width: 320,
        height: 320,
        size: '44.2MB',
        license: 'MIT',
        homepage: 'https://github.com/danielgatis/rembg',
        feedInput: 'input.1'
    },
    'BEN2_Base.onnx': {
        width: 1024,
        height: 1024,
        size: '222.9MB',
        license: 'MIT',
        homepage: 'https://github.com/PramaLLC/BEN2/',
        feedInput: 'input.1'
    },
    'isnet-general-use.onnx': {
        width: 1024,
        height: 1024,
        size: '178.6MB',
        license: 'MIT',
        homepage: 'https://github.com/danielgatis/rembg',
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

export function getConfig (): {
    success: boolean;
    data: AppOptions | null;
    error: null | Error;
    path: string;
} {
    const configPath = setupConfig();
    try {
        const config = fs.readFileSync(configPath, 'utf-8');
        const options: AppOptions = JSON.parse(config)
        // 检查模型是否已经下载到 options.modelDir
        if (options.models) {
            // 检查模型是否已经下载到 options.modelDir
            for (const model in options.models) {
                const exists = fs.existsSync(path.join(options.modelDir, model));
                console.log(`模型[${model}]${exists ? '已下载' : '未下载'}: ${path.join(options.modelDir, model)}`);
                options.models[model].downloaded = exists;
            }
        }
        return {
            success: true,
            data: options,
            path: configPath,
            error: null,
        }
    } catch (e) {
        return {
            error: e,
            data: null,
            path: configPath,
            success: false,
        };
    }
}

// 更新配置
export function updateConfig (options: Partial<AppOptions>):  {
    success: boolean;
    data: string | null;
    error: null | Error;
} {
    try {
        const res = getConfig()
        if (!res.success) {
            return {
                success: false,
                data: null,
                error: res.error
            }
        } else {
            const data = res.data;
            const localOptions = JSON.parse(data);
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