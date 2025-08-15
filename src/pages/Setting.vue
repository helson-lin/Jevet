<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from "vue";
import { useI18n } from "vue-i18n";
import { FolderOpen, Download, Loading, CheckOne, Log } from "@icon-park/vue-next";
import { message, Modal, type UploadProps } from "ant-design-vue";
import { useStore } from "../store/index";
import { useRouter } from "vue-router";
import Icon from "../components/Icon.vue";
const { t, locale: i18nLocale } = useI18n();
const router = useRouter();

interface ModelInfo {
  id: string;
  name: string;
  fileName: string;
  size: string;
  status: "not_downloaded" | "downloading" | "downloaded";
  downloaded: boolean;
  progress?: number;
  license: string;
  homepage: string;
}

export interface ModelOptionItem {
  width: number;
  height: number;
  size: string;
  license: string;
  homepage: string;
  downloaded: boolean;
  feedInput: string;
}

export interface ModelOption {
  [key: string]: ModelOptionItem;
}

interface AppOptions {
  modelDir: string;
  outputDir: string;
  language: string;
  theme: string;
  useGPU?: boolean;
  graphOptimizationLevel?: 'disabled' | 'basic' | 'extended' | 'all';
  models: ModelOption;
}

interface UpdateReponse {
  success: boolean;
  data: string | null;
  error: null | Error;
}

const store = useStore();

const settings = computed<AppOptions>(() => store.settings);

const models = ref<ModelInfo[]>([]);

const simpleUID = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

const setModelInfo = (modelsOptions: ModelOption) => {
  const modelKeys = Object.keys(modelsOptions);
  const arr = modelKeys.reduce<any[]>((pre, val: string) => {
    const item = modelsOptions[val];
    pre.push({
      id: simpleUID(),
      name: val.replace(".onnx", ""),
      fileName: val,
      size: item.size,
      license: item.license,
      homepage: item.homepage,
      downloaded: item.downloaded,
      progress: 0,
      status: item.downloaded ? "downloaded" : "not_downloaded",
    });
    return pre;
  }, []);
  models.value = arr;
};

watchEffect(() => {
  if (settings) {
    setModelInfo(settings.value.models);
  }
});

const selectModelPath = async () => {
  try {
    const result = await window.ipcRenderer.invoke("select-directory", {
      title: t("settings.modelPath"),
      buttonLabel: t("settings.selectModelPath"),
    });
    if (result.success) {
      updateSettings({ modelDir: result.data }, () => {
        // 更新设置信息
        store.updatePaths({ modelDir: result.data });
        message.success(t("settings.updateSuccess"));
        // 更新模型信息
        store.getConfig();
      });
    }
  } catch (error) {
    console.error("Failed to select directory:", error);
  }
};

const updateSettings = async (
  options: Partial<AppOptions>,
  callback: Function
) => {
  const data: UpdateReponse = await window.ipcRenderer.invoke(
    "updateConfig",
    options
  );
  if (data.success) {
    if (callback && typeof callback === "function") callback(data.data);
  } else if (data.error && !data.success) {
    message.warning(data.error.message);
  }
};

const selectOutputPath = async () => {
  try {
    const result = await window.ipcRenderer.invoke("select-directory", {
      title: t("settings.outputPath"),
      buttonLabel: t("settings.selectOutputPath"),
    });
    if (result.success) {
      updateSettings({ outputDir: result.data }, () => {
        store.updatePaths({ outputDir: result.data });
        message.success(t("settings.updateSuccess"));
      });
    }
  } catch (error) {
    console.error("Failed to select directory:", error);
  }
};

const updateLanguage = (language: "zh" | "en") => {
  updateSettings({ language }, () => {
    i18nLocale.value = language;
    store.updatePaths({ language });
    // 同时更新 localStorage
    localStorage.setItem('language', language);
    message.success(t("settings.updateSuccess"));
  });
};

const openHomePage = (homepage: string) =>
  window.ipcRenderer.invoke("open-external-url", homepage);

// 刷新模型列表
const refreshModelList = async () => {
  try {
    await store.getConfig();
    message.success(t("settings.refreshSuccess") || "Refresh success");
  } catch (error) {
    console.error("Failed to refresh model list:", error);
    message.error(t("settings.refreshError") || "Refresh failed");
  }
};

// 开始下载
const startDownload = async (modelInfo: ModelInfo) => {
  const modelIndex = models.value.findIndex((item) => item.id === modelInfo.id);
  const model = models.value[modelIndex];
  try {
    // 监听下载进度
    window.ipcRenderer.on("download-progress", (event, data) => {
      console.warn(data);
      if (data.modelId === modelInfo.id) {
        model.status = "downloading";
        model.progress = data.progress;
      }
    });
    // 启动下载
    const result = await window.ipcRenderer.invoke("dowloadModel", {
      url: `https://storage.helson-lin.cn/models/${modelInfo.fileName}`,
      fileName: modelInfo.fileName,
      modelId: modelInfo.id,
    });
    if (result.success) {
      model.status = "downloaded";
      model.downloaded = true;
    } else {
      message.warning(result.message);
      // 自动清除模型文件
      try {
        await window.ipcRenderer.invoke('deleteIncompleteModel', {
          fileName: modelInfo.fileName,
          modelId: modelInfo.id
        });
        console.log("Auto delete incomplete model file:", modelInfo.fileName);
      } catch (deleteError) {
        console.error("Failed to delete incomplete model file:", deleteError);
      }
      model.status = "not_downloaded";
      model.progress = 0;
      console.error("Download failed:", result.message);
    }
  } catch (error) {
    console.error("Download error:", error);
    message.warning(String(error));
    // 下载异常时也尝试清理文件
    try {
      await window.ipcRenderer.invoke('deleteIncompleteModel', {
        fileName: modelInfo.fileName,
        modelId: modelInfo.id
      });
      console.log("Auto delete incomplete model file:", modelInfo.fileName);
    } catch (deleteError) {
      console.error("Failed to delete incomplete model file:", deleteError);
    }
    model.status = "not_downloaded";
    model.progress = 0;
  }
};

// 取消下载
const cancelDownload = (modelId: string) => {
  window.ipcRenderer.send(`cancel-download-${modelId}`);
};

// 打开日志页面
const openLogViewer = () => {
  router.push('/logs');
};

// 处理 GPU 开关切换
const handleGPUToggle = async (val: boolean) => {
  if (!val) {
    // 关闭 GPU 加速，直接保存
    updateSettings({ useGPU: false }, () => {
      store.getConfig();
      message.success(t('settings.updateSuccess'));
    });
    return;
  }

  // 开启 GPU 加速前先检查 CUDA 环境
  try {
    message.loading({ content: t('settings.cudaChecking'), key: 'cuda-check' });
    
    const result = await window.electronAPI.invoke('check-cuda-status');
    
    message.destroy('cuda-check');
    
    if (result.success && result.cudaAvailable) {
      // CUDA 环境正常，可以开启 GPU 加速
      updateSettings({ useGPU: true }, () => {
        store.getConfig();
        message.success(`${t('settings.cudaEnabled')} (${result.version || t('settings.cudaAvailable')})`);
      });
    } else {
      // CUDA 环境不可用，显示详细的错误信息
      const errorMessage = result.errorMessage || t('settings.cudaEnvCheckFailed');
      const defaultRecommendations = [
        t('settings.cudaSolution1'),
        t('settings.cudaSolution2'),
        t('settings.cudaSolution3')
      ];
      const recommendations = result.recommendations || defaultRecommendations;
      
      // 显示详细的错误对话框
      const content = [
        t('settings.cudaSolutions'),
        ...recommendations.map((r: string, index: number) => `${index + 1}. ${r}`)
      ].join('\n');
      
      Modal.error({
        title: t('settings.cudaCheckFailed'),
        content: `${errorMessage}\n\n${content}`,
        width: 500,
        okText: t('settings.understood'),
        centered: true
      });
      
      console.warn('CUDA detection failure details:', result.diagnosticInfo);
    }
  } catch (error: any) {
    message.destroy('cuda-check');
    Modal.error({
      title: t('settings.cudaCheckError'),
      content: `${t('settings.cudaCheckException')}${error?.message || t('settings.cudaErrorUnknown')}\n\n${t('settings.cudaRetryTip')}`,
      width: 400,
      okText: t('settings.understood'),
      centered: true
    });
    console.error('CUDA detection exception:', error);
  }
};
</script>

<template>
  <div
    class="setting dark:bg-zinc-800 w-full h-full overflow-y-auto py-4"
  >
    <div class="max-w-3xl mx-auto h-full px-4 sm:px-6 lg:px-8">
      <div class="space-y-6 pb-4">
        <!-- 开源软件提示 -->
        <section class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-sm">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="text-base font-medium text-gray-900 dark:text-zinc-300 mb-2 flex items-center">
                <span class="mr-2">🎉</span>
                {{ t('opensource.title') }}
              </h3>
              <p class="text-sm text-gray-600 dark:text-zinc-400 mb-3">
                {{ t('opensource.description') }}
              </p>
              
              <!-- 捐助信息 -->
              <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded p-2 mb-3">
                <p class="text-xs text-green-800 dark:text-green-200 flex items-start">
                  <span class="mr-2">💝</span>
                  {{ t('opensource.donateDesc') }}
                </p>
              </div>
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div class="flex flex-wrap gap-2">
            <a-button 
              type="primary" 
              size="small"
              @click="() => openHomePage('https://github.com/helson-lin/Jevet')"
              class="hover:opacity-90 transition-opacity"
            >
              <template #icon>
                <Icon name="github" :size="14" light="#FFFFFF" dark="#FFFFFF"  class="mr-1"/>
              </template>
              {{ t('opensource.github') }}
            </a-button>
            <a-button 
              size="small"
              @click="() => openHomePage('https://github.com/helson-lin/Jevet/issues')"
              class="hover:opacity-90 transition-opacity"
            >
              {{ t('opensource.report') }}
            </a-button>
            <a-button 
              size="small"
              @click="() => openHomePage('https://github.com/helson-lin/Jevet')"
              class="hover:opacity-90 transition-opacity bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100 hover:border-pink-300 dark:bg-pink-900/20 dark:border-pink-700 dark:text-pink-300 dark:hover:bg-pink-900/30"
            >
              <template #icon>
                <span class="mr-1">💝</span>
              </template>
              {{ t('opensource.donate') }}
            </a-button>
          </div>
        </section>
        <!-- 路径设置 -->
        <section class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm">
          <h2
            class="text-large font-semibold dark:text-zinc-300 text-gray-900 mb-4 flex items-center"
          >
            {{ t("settings.paths") }}
          </h2>

          <div class="space-y-6">
            <!-- 语言设置 -->
            <div class="flex flex-col space-y-3">
              <label
                class="text-sm font-medium text-gray-700 dark:text-zinc-300"
                >{{ t("settings.language") }}</label
              >
              <div class="flex space-x-3">
                <a-select
                  v-model:value="settings.language"
                  class="w-full"
                  @change="updateLanguage"
                >
                  <a-select-option value="en">English</a-select-option>
                  <a-select-option value="zh">中文</a-select-option>
                </a-select>
              </div>
            </div>
            <!-- 模型路径 -->
            <div class="flex flex-col space-y-3">
              <label
                class="text-sm font-medium text-gray-700 dark:text-zinc-300"
                >{{ t("settings.modelPath") }}</label
              >
              <div class="flex space-x-3">
                <a-input
                  v-model:value="settings.modelDir"
                  :placeholder="t('settings.selectModelPath')"
                  readonly
                  class="flex-1 hover:border-primary focus:border-primary focus:shadow-sm transition-all"
                />
                <div class="pl-6">
                  <a-button
                    type="primary"
                    @click="selectModelPath"
                    class="hover:opacity-90 transition-opacity align-middle"
                  >
                    <template #icon>
                      <Icon
                        name="folder-open"
                        :size="18"
                        light="#EAEAEA"
                        dark="#efefef"
                        class="mr-2"
                      />
                    </template>
                    {{ t("settings.browse") }}
                  </a-button>
                </div>
              </div>
            </div>

            <!-- 输出路径 -->
            <div class="flex flex-col space-y-3">
              <label
                class="text-sm font-medium text-gray-700 dark:text-zinc-300"
                >{{ t("settings.outputPath") }}</label
              >
              <div class="flex space-x-3">
                <a-input
                  v-model:value="settings.outputDir"
                  :placeholder="t('settings.selectOutputPath')"
                  readonly
                  class="flex-1 hover:border-primary focus:border-primary focus:shadow-sm transition-all"
                />
                <div class="pl-6">
                  <a-button
                    type="primary"
                    @click="selectOutputPath"
                    class="hover:opacity-90 transition-opacity align-middle"
                  >
                    <template #icon>
                      <Icon
                        name="folder-open"
                        :size="18"
                        light="#EAEAEA"
                        dark="#efefef"
                        class="mr-2"
                      />
                    </template>
                    {{ t("settings.browse") }}
                  </a-button>
                </div>
              </div>
            </div>

            <!-- 推理配置 -->
            <div class="flex flex-col space-y-3">
              <label class="text-sm font-medium text-gray-700 dark:text-zinc-300">{{ t('settings.inference') }}</label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded px-3 border-zinc-200 dark:border-zinc-700 py-2">
                <div class="flex items-center justify-between rounded px-3 py-2">
                  <span class="text-sm text-gray-700 dark:text-zinc-300">{{ t('settings.useGPU') }}</span>
                  <a-switch
                    :checked="settings.useGPU"
                    @change="handleGPUToggle"
                  />
                </div>
                <div class="flex items-center justify-between rounded px-3 py-2">
                  <span class="text-sm text-gray-700 dark:text-zinc-300">{{ t('settings.graphOptimizationLevel') }}</span>
                  <a-select
                    :value="settings.graphOptimizationLevel || 'basic'"
                    class="w-40"
                    @change="(val: any) => updateSettings({ graphOptimizationLevel: val }, () => { store.getConfig(); message.success(t('settings.updateSuccess')) })"
                  >
                    <a-select-option value="disabled">disabled</a-select-option>
                    <a-select-option value="basic">basic</a-select-option>
                    <a-select-option value="extended">extended</a-select-option>
                    <a-select-option value="all">all</a-select-option>
                  </a-select>
                </div>
              </div>
              <p class="text-xs text-gray-500 dark:text-zinc-400">{{ t('settings.inferenceTips') }}</p>
            </div>
          </div>
        </section>

        <!-- 模型管理 -->
        <section class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm">
          <div class="flex items-center justify-between">
            <h2
              class="text-large font-semibold text-gray-900 dark:text-zinc-300"
            >
              {{ t("settings.modelManagement") }}
            </h2>
            <!-- 刷新按钮 -->
            <div
              @click="refreshModelList"
              class="hover:opacity-90 p-2 cursor-pointer transition-opacity flex items-center justify-center"
            >
              <Icon name="refresh" :size="18" light="#EAEAEA" dark="#efefef" />
            </div>
          </div>
          <!-- 模型选择提示信息-->
          <div class="text-sm text-gray-500 dark:text-zinc-300 flex flex-col items-start mb-2 bg-gray-150 dark:bg-amber-900/20 p-2 rounded" v-if="models.length > 0">
            <span v-html="t('settings.modelNotice')"></span>
          </div>


          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              v-for="model in models"
              :key="model.name"
              class="bg-white dark:bg-zinc-800 rounded-lg p-5 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-300 hover:shadow-md shadow-sm"
            >
              <div class="flex items-start justify-between">
                <div class="space-y-2">
                  <h3 class="font-medium text-gray-900 dark:text-zinc-300">
                    {{ model.name }}
                  </h3>
                  <div
                    class="text-sm text-gray-500 dark:text-zinc-300 flex flex-col items-start"
                  >
                    <div class="flex items-center">
                      <span
                        class="inline-block w-2 h-2 rounded-full mr-2"
                        :class="{
                          'bg-green-500': model.status === 'downloaded',
                          'bg-yellow-500': model.status === 'downloading',
                          'bg-gray-400': model.status === 'not_downloaded',
                        }"
                      >
                      </span>
                      <span>{{ model.size }}</span>
                    </div>
                    <div class="mt-2">
                      <span class="mr-2">License: {{ model.license }}</span>
                      <a
                        @click="openHomePage(model.homepage)"
                        class="inline-flex items-center"
                      >
                        Homepage:
                        <Icon name="BrowserSafari" size="18" class="ml-2" />
                      </a>
                    </div>
                  </div>
                </div>

                <div class="flex items-center">
                  <template v-if="model.status === 'downloaded'">
                    <check-one
                      theme="outline"
                      size="24"
                      fill="#10B981"
                      class="text-green-500"
                    />
                  </template>
                  <template v-else>
                    <a-button
                      type="primary"
                      :loading="model.status === 'downloading'"
                      @click="startDownload(model)"
                      class="hover:opacity-90 transition-opacity align-middle"
                    >
                      <template #icon>
                        <Icon
                          name="download"
                          class="mr-2"
                          v-if="model.status === 'not_downloaded'"
                          :size="18"
                          light="#EAEAEA"
                          dark="#efefef"
                        />
                        <!-- <download v-if="model.status === 'not_downloaded'" theme="outline" size="18" /> -->
                        <loading v-else theme="outline" size="18" />
                      </template>
                      {{
                        model.status === "downloading"
                          ? `${model.progress}%`
                          : t("settings.download")
                      }}
                    </a-button>
                  </template>
                </div>
              </div>

              <div v-if="model.status === 'downloading'" class="mt-4">
                <a-progress
                  :percent="model.progress"
                  size="small"
                  :stroke-color="{ from: '#108ee9', to: '#87d068' }"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- 系统管理 -->
        <section class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm">
          <h2
            class="text-large font-semibold dark:text-zinc-300 text-gray-900 mb-4 flex items-center"
          >
            {{ t("settings.systemManagement") }}
          </h2>

          <div class="space-y-4">
            <!-- 日志查看器 -->
            <div class="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-200">
              <div class="flex items-center space-x-3">
                <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <log theme="outline" size="20" fill="#3B82F6" />
                </div>
                <div>
                  <h3 class="text-sm font-medium text-gray-900 dark:text-zinc-300">
                    {{ t("settings.logViewer") }}
                  </h3>
                  <p class="text-xs text-gray-500 dark:text-zinc-400">
                    {{ t("settings.logViewerDesc") }}
                  </p>
                </div>
              </div>
              <a-button 
                type="default" 
                @click="openLogViewer"
                class="hover:opacity-90 transition-opacity"
              >
                {{ t("settings.openLogViewer") }}
              </a-button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
