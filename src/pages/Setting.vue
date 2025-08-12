<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from "vue";
import { useI18n } from "vue-i18n";
import { FolderOpen, Download, Loading, CheckOne } from "@icon-park/vue-next";
import { message, type UploadProps } from "ant-design-vue";
import { useStore } from "../store/index";
import Icon from "../components/Icon.vue";
const { t, locale: i18nLocale } = useI18n();

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
    message.success(t("settings.updateSuccess"));
  });
};

const openHomePage = (homepage: string) =>
  window.ipcRenderer.invoke("open-external-url", homepage);

// 刷新模型列表
const refreshModelList = async () => {
  try {
    await store.getConfig();
    message.success(t("settings.refreshSuccess") || "刷新成功");
  } catch (error) {
    console.error("Failed to refresh model list:", error);
    message.error(t("settings.refreshError") || "刷新失败");
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
    console.log('开始下载', modelInfo.fileName);
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
        console.log("已自动删除未完成的模型文件:", modelInfo.fileName);
      } catch (deleteError) {
        console.error("删除未完成模型文件失败:", deleteError);
      }
      model.status = "not_downloaded";
      model.progress = 0;
      console.error("下载失败:", result.message);
    }
  } catch (error) {
    console.error("下载出错:", error);
    message.warning(String(error));
    // 下载异常时也尝试清理文件
    try {
      await window.ipcRenderer.invoke('deleteIncompleteModel', {
        fileName: modelInfo.fileName,
        modelId: modelInfo.id
      });
      console.log("已自动删除未完成的模型文件:", modelInfo.fileName);
    } catch (deleteError) {
      console.error("删除未完成模型文件失败:", deleteError);
    }
    model.status = "not_downloaded";
    model.progress = 0;
  }
};

// 取消下载
const cancelDownload = (modelId: string) => {
  window.ipcRenderer.send(`cancel-download-${modelId}`);
};
</script>

<template>
  <div
    class="setting bg-gray-200 dark:bg-zinc-800 w-full h-full overflow-y-auto py-4"
  >
    <div class="max-w-3xl mx-auto h-full px-4 sm:px-6 lg:px-8">
      <div class="space-y-6 pb-4">
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
          </div>
        </section>

        <!-- 模型管理 -->
        <section class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm">
          <div class="flex items-center justify-between mb-4">
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
      </div>
    </div>
  </div>
</template>
