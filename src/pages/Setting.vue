<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderOpen, Download, Loading, CheckOne } from '@icon-park/vue-next';
import { message, type UploadProps } from 'ant-design-vue';

const { t } = useI18n();

interface ModelInfo {
  name: string;
  size: string;
  status: 'not_downloaded' | 'downloading' | 'downloaded';
  downloaded: boolean;
  progress?: number;
}

export interface ModelOptionItem {
    width: number;
    height: number;
    size: string;
    downloaded: boolean;
    feedInput: string;
}

export interface ModelOption {
    [key: string]: ModelOptionItem
}

interface AppOptions {
  modelDir: string;
  outputDir: string;
  language:  string;
  theme:  string;
  models: ModelOption;
}

interface UpdateReponse {
    success: boolean;
    data: string | null;
    error: null | Error;
}

const settings = ref<AppOptions>({
  modelDir:  '',
  outputDir: '',
  language: 'zh',
  theme: 'auto',
  models: {},
});

const models = ref<ModelInfo[]>([]);

window.ipcRenderer.invoke('getConfig').then((res) => {
  if (res.success) {
    const config = res.data
    if (config.outputDir) settings.value.outputDir = config.outputDir
    if (config.modelDir) settings.value.modelDir= config.modelDir
    if (config.language) settings.value.language = config.language
    if (config.theme) settings.value.theme = config.theme
    if (config.models) {
      settings.value.models = config.models
      setModelInfo(config.models)
    }
  }
})

const setModelInfo = (modelsOptions: ModelOption) => {
  const modelKeys = Object.keys(modelsOptions)
  const arr = modelKeys.reduce<any[]>((pre, val: string) => {
    const item = modelsOptions[val]
    pre.push({
      name: val.replace('.onnx', ''),
      size: item.size,
      downloaded: item.downloaded,
      status: item.downloaded ? 'downloaded' : 'not_downloaded'
    })
    return pre;
  }, [])
  models.value = arr
}

const selectModelPath = async () => {
  try {
    const result = await window.ipcRenderer.invoke('select-directory', { title: t('settings.modelPath'), buttonLabel: t('settings.selectModelPath') });
    if (result.success) {
      updateSettings({ modelDir: result.data }, () => {
        settings.value.modelDir = result.data;
      })
    }
  } catch (error) {
    console.error('Failed to select directory:', error);
  }
};

const updateSettings = async (options: Partial<AppOptions>, callback: Function) => {
  const data: UpdateReponse = await window.ipcRenderer.invoke('updateConfig', options)
  if (data.success) {
    if (callback && typeof callback === 'function') callback(data.data)
  } else if (data.error && !data.success) {
    message.warning(data.error.message)
  }
}

const selectOutputPath = async () => {
  try {
    const result = await window.ipcRenderer.invoke('select-directory', { title: t('settings.outputPath'), buttonLabel: t('settings.selectOutputPath') });
    if (result.success) {
      updateSettings({ outputDir: result.data }, () => {
        settings.value.outputDir = result.data;
      })
    }
  } catch (error) {
    console.error('Failed to select directory:', error);
  }
};

// 开始下载
const startDownload = async (modelInfo) => {
  try {
    // 监听下载进度
    window.ipcRenderer.on('download-progress', (event, data) => {
      if (data.modelId === modelInfo.id) {
        // 更新进度显示
        console.log(`下载进度: ${data.progress}%`);
        // 更新UI显示进度
      }
    });
    
    // 启动下载
    const result = await window.ipcRenderer.invoke('dowloadModel', {
      url: modelInfo.downloadUrl,
      fileName: modelInfo.fileName,
      modelId: modelInfo.id
    });
    
    if (result.success) {
      console.log('下载成功:', result.filePath);
    } else {
      console.error('下载失败:', result.message);
    }
  } catch (error) {
    console.error('下载出错:', error);
  }
};

// 取消下载
const cancelDownload = (modelId: string) => {
  window.ipcRenderer.send(`cancel-download-${modelId}`);
};
</script>

<template>
  <div class="setting bg-gray-50 dark:bg-zinc-800 w-full h-full overflow-y-auto py-4">
    <div class="max-w-3xl mx-auto h-full px-4 sm:px-6 lg:px-8">
      <div class="space-y-6  pb-4">
        <!-- 路径设置 -->
        <section class="bg-white dark:bg-zinc-800  rounded-xl p-6 shadow-sm">
          <h2 class="text-large font-semibold dark:text-zinc-300 text-gray-900 mb-6 flex items-center">
            {{ t('settings.paths') }}
          </h2>
          
          <div class="space-y-6">
            <!-- 模型路径 -->
            <div class="flex flex-col space-y-3">
              <label class="text-sm font-medium text-gray-700 dark:text-zinc-300">{{ t('settings.modelPath') }}</label>
              <div class="flex space-x-3">
                <a-input
                  v-model:value="settings.modelDir"
                  :placeholder="t('settings.selectModelPath')"
                  readonly
                  class="flex-1 hover:border-primary focus:border-primary focus:shadow-sm transition-all"
                />
                <div class="pl-6">
                  <a-button type="primary" @click="selectModelPath" class="hover:opacity-90 transition-opacity align-middle">
                    <template #icon>
                      <Icon name="folder-open" :size="18" light="#EAEAEA" dark="#efefef" class="mr-2"/>
                    </template>
                    {{ t('settings.browse') }}
                  </a-button>
                </div>
              </div>
            </div>

            <!-- 输出路径 -->
            <div class="flex flex-col space-y-3">
              <label class="text-sm font-medium text-gray-700 dark:text-zinc-300">{{ t('settings.outputPath') }}</label>
              <div class="flex space-x-3">
                <a-input
                  v-model:value="settings.outputDir"
                  :placeholder="t('settings.selectOutputPath')"
                  readonly
                  class="flex-1 hover:border-primary focus:border-primary focus:shadow-sm transition-all"
                />
                <div class="pl-6">
                  <a-button type="primary" @click="selectOutputPath" class="hover:opacity-90 transition-opacity align-middle">
                    <template #icon>
                      <Icon name="folder-open" :size="18" light="#EAEAEA" dark="#efefef" class="mr-2"/>
                    </template>
                    {{ t('settings.browse') }}
                  </a-button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 模型管理 -->
        <section class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm">
          <h2 class="text-large font-semibold text-gray-900 dark:text-zinc-300 mb-6 flex items-center">
            {{ t('settings.modelManagement') }}
          </h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              v-for="model in models"
              :key="model.name"
              class="bg-gray-50 dark:bg-gray-700 rounded-lg p-5 border border-gray-100 dark:border-zinc-500  hover:border-primary transition-all duration-300 hover:shadow-md"
            >
              <div class="flex items-start justify-between">
                <div class="space-y-2">
                  <h3 class="font-medium text-gray-900 dark:text-zinc-300">{{ model.name }}</h3>
                  <p class="text-sm text-gray-500 dark:text-zinc-300 flex items-center">
                    <span class="inline-block w-2 h-2 rounded-full mr-2"
                          :class="{
                            'bg-green-500': model.status === 'downloaded',
                            'bg-yellow-500': model.status === 'downloading',
                            'bg-gray-400': model.status === 'not_downloaded'
                          }">
                    </span>
                    {{ model.size }}
                  </p>
                </div>
                
                <div class="flex items-center">
                  <template v-if="model.status === 'downloaded'">
                    <check-one theme="outline" size="24" fill="#10B981" class="text-green-500" />
                  </template>
                  <template v-else>
                    <a-button 
                    type="primary"
                    :loading="model.status === 'downloading'"
                    @click="downloadModel(model)"
                    class="hover:opacity-90 transition-opacity align-middle"
                    >
                    <template #icon>
                      <Icon name="download" class="mr-2" v-if="model.status === 'not_downloaded'" :size="18"  light="#EAEAEA" dark="#efefef" />
                      <!-- <download v-if="model.status === 'not_downloaded'" theme="outline" size="18" /> -->
                      <loading v-else theme="outline" size="18" />
                    </template>
                      {{ model.status === 'downloading' ? `${model.progress}%` : t('settings.download') }}
                    </a-button>
                  </template>
                </div>
              </div>
              
              <div v-if="model.status === 'downloading'" class="mt-4">
                <a-progress :percent="model.progress" size="small" :stroke-color="{ from: '#108ee9', to: '#87d068' }" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
