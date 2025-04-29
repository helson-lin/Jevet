<script setup lang="ts">
interface SHARP_RESULT {
  outputPath: string;
  base64Image: string;
  preview: string;
  fileSize: number;
  uid: string;
}

interface PROCESED_ITEM {
  uid: string;
  status: 0 | 1 | 2;
  outputPath: string;
  preview: string;
  file: File;
  filename: string;
  type: string;
  decrease: boolean;
  size: string;
  compressionRatio: string;
  handledSize: string;
  base64Image: string;
}

import { ref, computed, h, watchEffect } from "vue";
import { useStore } from '../store/index';
import Upload from "../components/Upload.vue";
import { message, Modal, type UploadFile, type SelectProps } from "ant-design-vue";
import { useI18n } from 'vue-i18n';
import {
  Export,
  PreviewOpen,
  DeleteOne,
  PlayOne,
  CheckSmall,
  ArrowRight,
  Info,
} from "@icon-park/vue-next";

const { t } = useI18n();
const store = useStore();
const list = ref<UploadFile[]>([]);
const loading = ref(false);
const processImgs = ref<SHARP_RESULT[]>([]);

const processType = (type?: string) =>
  type ? type.replace("image/", "")?.toLocaleUpperCase() : "";

function calculateCompressionRatio(
  originalSize: number,
  compressedSize: number
) {
  // 计算压缩节省的字节数
  const savedBytes = originalSize - compressedSize;

  // 计算压缩率（压缩后占原始的比例）
  const compressionRatio = compressedSize / originalSize;

  // 计算压缩百分比（节省的比例）
  const compressionPercentage = (1 - compressionRatio) * 100;

  // 返回计算结果
  return compressionPercentage.toFixed(2) + "%";
}

const previewList = computed(() => {
  return list.value.reduce<PROCESED_ITEM[]>((pre, val) => {
    // 是否已经处理过
    const isInResult = processImgs.value.find(
      (result) => result?.uid === val?.uid
    );
    if (!isInResult) {
      pre.push({
        uid: val.uid,
        status: 2,
        outputPath: "",
        file: val?.originFileObj as File,
        size: formatFileSize(val.originFileObj?.size) || "",
        handledSize: "",
        decrease: false,
        filename: val.originFileObj?.name || "",
        type: processType(val.originFileObj?.type) || "",
        preview: URL.createObjectURL(val.originFileObj as File),
        compressionRatio: "",
        base64Image: "",
      });
    } else {
      pre.push({
        uid: val.uid,
        status: 1,
        outputPath: isInResult.outputPath,
        file: val?.originFileObj as File,
        filename: val.originFileObj?.name || "",
        size: formatFileSize(val.originFileObj?.size) || "",
        handledSize: formatFileSize(isInResult.fileSize),
        decrease: val?.originFileObj?.size
          ? isInResult.fileSize < val?.originFileObj?.size
          : false,
        type: processType(val.originFileObj?.type) || "",
        preview: URL.createObjectURL(val.originFileObj as File),
        compressionRatio: val.originFileObj?.size
          ? calculateCompressionRatio(
            val.originFileObj?.size,
            isInResult?.fileSize
          )
          : "",
        base64Image: isInResult?.base64Image,
      });
    }
    return pre;
  }, []);
});

// const supportedModels = [
//   'u2net',
//   'silueta',
//   'u2net_human_seg',
//   'u2net_cloth_seg',
//   'rmbg-1.4'
// ];

const supportedModels = computed(() => {
  const models = store.settings.models || {};
  return Object.keys(models)
    .filter(key => models[key].downloaded)
    .map(key => key.replace('.onnx', ''));
});

const options = ref<{
  model: string;
  quality: number;
  outputformat: string;
}>({
  model: 'u2net',
  quality: 80,
  outputformat: "png",
});

watchEffect(() => {
  if (supportedModels.value.length > 0) {
    options.value.model = supportedModels.value[0];
  }
})

const supportedFormat = [
  "png",
  "jpg",
  "jpeg",
  "webp"
];

const showQuality = computed(() => true);

// 删除图片
const deleteImg = (item: PROCESED_ITEM) => {
  const imgIndex = list.value.findIndex((listItem) => listItem.uid === item.uid);
  if (imgIndex !== -1) {
    list.value.splice(imgIndex, 1);
    message.success(t('imgProcess.deleteImgSuccess'));
  }
};

// 删除所有的图片
const deleteImgALl = () => {
  if (list.value.length === 0) {
    message.info(t('imgProcess.noImages'))
    return;
  }
  Modal.confirm({
    title: '',
    icon: h('div', {
      class: 'flex items-center'
    }, [
      h(Info, {
        theme: 'outline',
        size: '27',
        strokeLinejoin: 'bevel',
        strokeLinecap: 'square',
        fill: '#FF4D4F',
        class: 'mr-2'
      }),
      h('span', { class: 'inline-flex text-base font-bold' }, t('imgProcess.delete'))
    ]),
    content: t('imgProcess.deleteConfirm'),
    okText: t('imgProcess.confirm'),
    okType: 'danger',
    cancelText: t('imgProcess.cancel'),
    onOk() {
      list.value = [];
      message.success(t('imgProcess.deleteSuccess'));
    },
    onCancel() { },
  });
};

const previewImg = (item: PROCESED_ITEM) => {
  window.ipcRenderer.invoke("open-win", `preview?url=${item.preview}&output=${item.outputPath}`);
};

const exportIMG = (filePath: string) => {
  window.ipcRenderer
    .invoke("moveToDownloads", filePath)
    .then(
      (res: { downloadsPaths: string[]; success: boolean; error?: string }) => {
        if (res.success && res.downloadsPaths?.[0]) {
          message.success(t('imgProcess.moveToDownloads', { path: res.downloadsPaths?.[0] }));
        } else if (res.error) {
          message.error(res.error);
        }
      }
    );
};

function formatFileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes === 0) return `0 ${t('imgProcess.bytes')}`;

  const k = 1024;
  const sizes = [
    t('imgProcess.bytes'),
    t('imgProcess.kb'),
    t('imgProcess.mb'),
    t('imgProcess.gb'),
    t('imgProcess.tb')
  ];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const processSingleIMG = async (item: PROCESED_ITEM) => {
  const fileBuffers = [];
  const bufferData = await item.file.arrayBuffer();
  fileBuffers.push({ buffer: bufferData, uid: item.uid });
  try {
    const optionsCloned = JSON.parse(JSON.stringify(options.value));
    window.ipcRenderer
      .invoke("pi", {
        imgs: fileBuffers,
        options: optionsCloned,
      })
      .then(
        (data: {
          success: boolean;
          results: SHARP_RESULT[];
          error?: string;
        }) => {
          console.log("✅", data);
          loading.value = false;
          if (data.success && data.results) {
            processImgs.value = data.results;
          } else {
            if (data.error) message.warning(data.error);
          }
        }
      )
      .catch((e) => {
        loading.value = false;
        message.error(e.message);
      });
  } catch (e: any) {
    loading.value = false;
    message.error(e.message);
  }
};

// 导出所有的图片
const exportAll = () => {
  const filePaths = previewList.value
    .filter((i) => i.status === 1)
    .map((i) => i.outputPath);
  if (filePaths.length === 0) {
    message.info(t('imgProcess.noExportImages'));
    return;
  }
  window.ipcRenderer
    .invoke("moveToDownloads", filePaths)
    .then(
      (res: { downloadsPaths: string[]; success: boolean; error?: string }) => {
        if (res.success && res.downloadsPaths?.[0]) {
          message.success(t('imgProcess.batchExportSuccess'));
        } else if (res.error) {
          message.error(res.error);
        }
      }
    );
};

const processIMG = async () => {
  const files = list.value;
  if (files.length === 0) {
    message.info(t('imgProcess.noImages'));
    return;
  }
  const fileBuffers = [];
  for (const singFile of files) {
    const bufferData = await (singFile.originFileObj as File).arrayBuffer();
    fileBuffers.push({ buffer: bufferData, uid: singFile.uid });
  }
  loading.value = true;
  try {
    const optionsCloned = JSON.parse(JSON.stringify(options.value));
    window.ipcRenderer
      .invoke("remove", {
        imgs: fileBuffers,
        options: optionsCloned,
      })
      .then(
        (data: {
          success: boolean;
          results: SHARP_RESULT[];
          error?: string;
        }) => {
          console.log("✅", data);
          loading.value = false;
          if (data.success && data.results) {
            processImgs.value = data.results;
          } else {
            if (data.error) message.warning(data.error);
          }
        }
      )
      .catch((e) => {
        loading.value = false;
        message.error(e.message);
      });
  } catch (e: any) {
    loading.value = false;
    message.error(e.message);
  }
};

const handleChange = (value: string) => {
  // No special handling needed for background removal
};
</script>

<template>
  <div class="flex w-full h-full bg-zinc-100 dark:bg-zinc-800 gap-4 p-4">
    <!-- 左侧上传区域 -->
    <div class="app-left w-2/3 h-full flex flex-col bg-white dark:bg-zinc-900 rounded-lg shadow-sm">
      <!-- 上传组件区域 -->
      <div class="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <Upload v-model:list="list" />
      </div>
      
      <!-- 图片列表区域 -->
      <div class="flex flex-col flex-1 p-4 overflow-y-auto">
        <!-- 标题栏 -->
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            {{ t('imgProcess.upload') }}
            <span class="text-sm font-normal text-zinc-500 ml-2">({{ previewList.length }})</span>
          </h3>
          <a-button 
            type="text" 
            danger 
            size="small"
            @click="deleteImgALl" 
            :disabled="list.length === 0"
            class="flex items-center gap-1">
            <delete-one :size="16" />
            {{ t('imgProcess.clearAll') }}
          </a-button>
        </div>
        
        <!-- 图片网格 -->
        <div class="flex-1 overflow-y-auto overflow-x-hidden">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4" v-if="previewList.length > 0">
            <div
              class="img-item bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:shadow-md transition-shadow h-60 flex flex-col"
              v-for="(ii, index) in previewList" 
              :key="ii.uid">
              
              <!-- 文件信息头部 -->
              <div class="p-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
                <div class="flex items-center justify-between">
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate" :title="ii.filename">
                      {{ ii.filename }}
                    </p>
                    <div class="flex items-center text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      <span class="dark:bg-zinc-600 px-1 py-0.5 rounded text-xs font-medium">
                        {{ ii.type }}
                      </span>
                      <span class="mx-1 text-xs">{{ ii.size }}</span>
                      <span v-if="ii.status === 1" class="flex items-center">
                        <arrow-right 
                          class="mx-1" 
                          theme="outline" 
                          size="10" 
                          :fill="ii.decrease ? '#00b96b' : '#FF523F'" />
                        <span :class="ii.decrease ? 'text-green-600' : 'text-red-500'" class="text-xs">
                          {{ ii.handledSize }}
                        </span>
                      </span>
                    </div>
                  </div>
                  <a-tag v-if="ii.status === 1" color="success" size="small">
                    {{ t('removeBg.processed') }}
                  </a-tag>
                </div>
              </div>
              
              <!-- 图片预览区域 -->
              <div class="img-box relative flex-1 bg-zinc-100 dark:bg-zinc-700 min-h-0">
                <a-image 
                  class="w-full h-full object-cover" 
                  :preview="{ visible: false }" 
                  :src="ii.preview" 
                  alt="image">
                  <template #previewMask>
                    <div class="flex flex-col items-center justify-center gap-2 p-2">
                      <div class="flex items-center gap-2">
                        <a-button type="primary" ghost size="small" @click="previewImg(ii)" class="flex items-center justify-center">
                          <preview-open :size="14" />
                        </a-button>
                        <a-button type="primary" ghost size="small" v-if="ii.status === 1" @click="exportIMG(ii.outputPath)" class="flex items-center justify-center">
                          <export :size="14" />
                        </a-button>
                      </div>
                      <a-button danger ghost size="small" @click="deleteImg(ii)" class="flex items-center justify-center">
                        <delete-one :size="14" />
                      </a-button>
                    </div>
                  </template>
                </a-image>
                
                <!-- 加载遮罩 -->
                <div
                  class="absolute inset-0 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm flex items-center justify-center rounded"
                  v-if="loading">
                  <a-spin />
                </div>
                
                <!-- 压缩率显示 -->
                <div v-if="ii.status === 1 && ii.compressionRatio" 
                     class="absolute top-2 right-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs font-medium">
                  -{{ ii.compressionRatio }}
                </div>
              </div>
            </div>
          </div>
          
          <!-- 空状态 -->
          <div v-else class="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
            <div class="text-center">
              <delete-one :size="48" class="mb-2 opacity-50" />
              <p>{{ t('imgProcess.noImages') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 右侧工具栏 -->
    <div class="app-right flex-1 flex flex-col bg-white dark:bg-zinc-900 rounded-lg shadow-sm">
      <!-- 设置标题 -->
      <div class="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          {{ t('removeBg.title') }}
        </h3>
      </div>
      
      <!-- 选项区域 -->
      <div class="flex-1 p-4 space-y-6">
        <!-- 模型选择 -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {{ t('removeBg.model') }}
          </label>
          <a-select 
            v-model:value="options.model" 
            class="w-full">
            <a-select-option v-for="model in supportedModels" :key="model" :value="model">
              {{ model.toUpperCase() }}
            </a-select-option>
          </a-select>
        </div>
        
        <!-- 压缩质量 -->
        <div class="space-y-2" v-if="showQuality">
          <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {{ t('removeBg.compression') }}
          </label>
          <a-slider 
            v-model:value="options.quality" 
            :min="1" 
            :max="100"
            :disabled="!showQuality"
            :tooltip-formatter="(value: number) => `${value}%`"
            class="mb-2" />
          <a-input-number 
            v-model:value="options.quality" 
            :min="1" 
            :max="100"
            :disabled="!showQuality"
            class="w-full">
            <template #addonAfter>%</template>
          </a-input-number>
        </div>
        
        <!-- 输出格式 -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {{ t('removeBg.outputFormat') }}
          </label>
          <a-select 
            v-model:value="options.outputformat" 
            @change="handleChange"
            class="w-full">
            <a-select-option v-for="format in supportedFormat" :key="format" :value="format">
              {{ format.toUpperCase() }}
            </a-select-option>
          </a-select>
          
          <!-- 格式提示 -->
          <div class="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded"
               v-if="options.outputformat === 'icns' || options.outputformat === 'ico'">
            <delete-one :size="12" class="inline mr-1" />
            {{ t(`removeBg.notice.${options.outputformat}`) }}
          </div>
        </div>
      </div>
      
      <!-- 操作按钮 -->
      <div class="p-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-b-lg">
        <div class="flex gap-2">
          <a-button 
            type="primary" 
            @click="processIMG" 
            :loading="loading"
            :disabled="list.length === 0"
            class="w-30 flex items-center">
              <play-one :size="16" v-if="!loading"/>
              <span v-show="!loading">
                {{ t('removeBg.batchProcess') }}
              </span>
          </a-button>
          <a-button 
            @click="exportAll" 
            :disabled="previewList.filter(i => i.status === 1).length === 0"
            class="w-30 flex items-center">
            <export :size="16" class="mr-1" />
            {{ t('removeBg.exportAll') }}
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-mask {
  background: rgba(0, 0, 0, 0.1);
}

.img-box {
  width: 100%;
}

.img-box >>> .ant-image {
  width: 100%;
  height: 100%;
}

.img-item {
  background: rgba(0, 0, 0, 0.1);
}

.dark .img-item {
  background: rgba(255, 255, 255, 0.1);
}
</style>
