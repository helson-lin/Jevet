import { defineStore } from 'pinia'
import { message } from 'ant-design-vue'

interface AppOptions {
    modelDir: string
    outputDir: string
    language: string
    theme: string
    useGPU?: boolean
    graphOptimizationLevel?: 'disabled' | 'basic' | 'extended' | 'all'
    models: Record<string, {
        width: number
        height: number
        size: string
        license: string
        homepage: string
        downloaded: boolean
        feedInput: string
        md5: string
    }>
}

interface AppConfig {
    theme: 'auto' | 'light' | 'dark'
    language: 'zh' | 'en'
    modelDir: string
    outputDir: string
    useGPU?: boolean
    graphOptimizationLevel?: 'disabled' | 'basic' | 'extended' | 'all'
    models: Record<string, {
        width: number
        height: number
        size: string
        license: string;
        homepage: string;
        downloaded: boolean
        feedInput: string
    }>
}

interface UpdateResponse {
    success: boolean
    data: AppConfig | null
    error: Error | null
}

export const useStore = defineStore('main', {
    state: () => {
        return {
            theme: 'auto' as AppConfig['theme'],
            language: 'zh' as AppConfig['language'],
            modelDir: '',
            outputDir: '',
            useGPU: false,
            graphOptimizationLevel: 'basic',
            models: {} as AppConfig['models']
        }
    },
    getters: {
        settings: (state): AppConfig => ({
            theme: state.theme,
            language: state.language,
            modelDir: state.modelDir,
            outputDir: state.outputDir,
            useGPU: state.useGPU,
            graphOptimizationLevel: state.graphOptimizationLevel,
            models: state.models
        })
    },
    actions: {
        async getConfig() {
            try {
                const res = await window.ipcRenderer.invoke('getConfig') as UpdateResponse
                if (res.success && res.data) {
                    const config = res.data
                    this.theme = config.theme
                    this.language = config.language
                    this.modelDir = config.modelDir
                    this.outputDir = config.outputDir
                    this.useGPU = config.useGPU ?? false
                    this.graphOptimizationLevel = (config.graphOptimizationLevel as any) || 'basic'
                    this.models = config.models
                    return true
                }
                return false
            } catch (error) {
                console.error('Failed to get config:', error)
                return false
            }
        },
        
        updatePaths(paths: { modelDir?: string; outputDir?: string, language?: AppConfig['language']
        }) {
            if (paths.modelDir !== undefined) {
                this.modelDir = paths.modelDir
            }
            if (paths.outputDir !== undefined) {
                this.outputDir = paths.outputDir
            }
            if (paths.language !== undefined) {
                this.language = paths.language
            }
        }
    }
})