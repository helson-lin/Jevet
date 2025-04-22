<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderOpen, Download, Loading, CheckOne } from '@icon-park/vue-next';
import type { UploadProps } from 'ant-design-vue';

const { t } = useI18n();

interface ModelInfo {
  name: string;
  size: string;
  status: 'not_downloaded' | 'downloading' | 'downloaded';
  progress?: number;
}

const settings = ref({
  modelPath: localStorage.getItem('modelPath') || '',
  outputPath: localStorage.getItem('outputPath') || '',
});

const models = ref<ModelInfo[]>([
  { 
    name: 'u2net',
    size: '176MB',
    status: 'downloaded'
  },
  {
    name: 'u2net_human_seg',
    size: '186MB',
    status: 'not_downloaded'
  },
  {
    name: 'u2net_cloth_seg',
    size: '176MB',
    status: 'not_downloaded'
  },
  {
    name: 'silueta',
    size: '43MB',
    status: 'downloading',
    progress: 45
  }
]);

const selectModelPath = async () => {
  try {
    const result = await window.ipcRenderer.invoke('select-directory');
    if (result.success) {
      settings.value.modelPath = result.path;
      localStorage.setItem('modelPath', result.path);
    }
  } catch (error) {
    console.error('Failed to select directory:', error);
  }
};

const selectOutputPath = async () => {
  try {
    const result = await window.ipcRenderer.invoke('select-directory');
    if (result.success) {
      settings.value.outputPath = result.path;
      localStorage.setItem('outputPath', result.path);
    }
  } catch (error) {
    console.error('Failed to select directory:', error);
  }
};

const downloadModel = (model: ModelInfo) => {
  if (model.status === 'downloading' || model.status === 'downloaded') return;
  
  model.status = 'downloading';
  model.progress = 0;
  
  // Simulate download progress
  const interval = setInterval(() => {
    if (model.progress !== undefined && model.progress < 100) {
      model.progress += 10;
    } else {
      clearInterval(interval);
      model.status = 'downloaded';
    }
  }, 500);
};
</script>

<template>
  <div class="setting bg-gray-50 w-full h-full overflow-y-auto py-4">
    <div class="max-w-3xl mx-auto h-full px-4 sm:px-6 lg:px-8">
      <div class="space-y-6  pb-4">
        <!-- 路径设置 -->
        <section class="bg-white rounded-xl p-6 shadow-sm">
          <h2 class="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <span class="inline-block w-1 h-6 bg-primary rounded mr-3"></span>
            {{ t('settings.paths') }}
          </h2>
          
          <div class="space-y-6">
            <!-- 模型路径 -->
            <div class="flex flex-col space-y-3">
              <label class="text-sm font-medium text-gray-700">{{ t('settings.modelPath') }}</label>
              <div class="flex space-x-3">
                <a-input
                  v-model:value="settings.modelPath"
                  :placeholder="t('settings.selectModelPath')"
                  readonly
                  class="flex-1 hover:border-primary focus:border-primary focus:shadow-sm transition-all"
                />
                <a-button type="primary" @click="selectModelPath" class="hover:opacity-90 transition-opacity">
                  <template #icon><folder-open theme="outline" size="18" /></template>
                  {{ t('settings.browse') }}
                </a-button>
              </div>
            </div>

            <!-- 输出路径 -->
            <div class="flex flex-col space-y-3">
              <label class="text-sm font-medium text-gray-700">{{ t('settings.outputPath') }}</label>
              <div class="flex space-x-3">
                <a-input
                  v-model:value="settings.outputPath"
                  :placeholder="t('settings.selectOutputPath')"
                  readonly
                  class="flex-1 hover:border-primary focus:border-primary focus:shadow-sm transition-all"
                />
                <a-button type="primary" @click="selectOutputPath" class="hover:opacity-90 transition-opacity">
                  <template #icon><folder-open theme="outline" size="18" /></template>
                  {{ t('settings.browse') }}
                </a-button>
              </div>
            </div>
          </div>
        </section>

        <!-- 模型管理 -->
        <section class="bg-white rounded-xl p-6 shadow-sm">
          <h2 class="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <span class="inline-block w-1 h-6 bg-primary rounded mr-3"></span>
            {{ t('settings.modelManagement') }}
          </h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              v-for="model in models"
              :key="model.name"
              class="bg-gray-50 rounded-lg p-5 border border-gray-100 hover:border-primary transition-all duration-300 hover:shadow-md"
            >
              <div class="flex items-start justify-between">
                <div class="space-y-2">
                  <h3 class="font-medium text-gray-900">{{ model.name }}</h3>
                  <p class="text-sm text-gray-500 flex items-center">
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
                      class="hover:opacity-90 transition-opacity"
                    >
                      <template #icon>
                        <download v-if="model.status === 'not_downloaded'" theme="outline" size="18" />
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

<style scoped>
.setting {
  color: var(--color-text);
  background-color: var(--color-bg-base, #f5f5f5);
}

:deep(.ant-progress-bg) {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.ant-input) {
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

:deep(.ant-input:hover) {
  border-color: var(--color-primary);
}

:deep(.ant-btn) {
  border-radius: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

:deep(.ant-btn-primary) {
  background: #1890ff;
  border-color: #1890ff;
  color: white;
}

:deep(.ant-btn-primary:hover) {
  background: #40a9ff;
  border-color: #40a9ff;
  color: white;
}

:deep(.ant-btn-primary:active) {
  background: #096dd9;
  border-color: #096dd9;
}

:deep(.ant-btn-primary[disabled]) {
  background: #f5f5f5;
  border-color: #d9d9d9;
  color: rgba(0, 0, 0, 0.25);
}
</style>