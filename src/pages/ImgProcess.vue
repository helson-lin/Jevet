<script setup lang="ts">
import { ref, computed, h } from "vue";
import Upload from "../components/Upload.vue";
import { message, Modal, type UploadFile, type SelectProps } from "ant-design-vue";
import { useI18n } from 'vue-i18n';
import {
  Export,
  PreviewOpen,
  PlayOne,
  CheckSmall,
  ArrowRight,
  Info,
} from "@icon-park/vue-next";

const { t } = useI18n();

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
      (result) => result.uid === val.uid
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

const options = ref<{
  width: number;
  height: number;
  quality: number;
  keepExif: boolean;
  originSize: boolean;
  outputformat: string;
}>({
  width: 0,
  height: 0,
  keepExif: false,
  originSize: true,
  quality: 80,
  outputformat: "webp",
});

const supportedFormat = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "jp2",
  "tiff",
  "heif",
  "icns",
  "ico",
];

const qualityDisabled = ["gif", "icns", "ico"];
const resizeDisabled = ["icns", "ico"];

const noticeMap = {
  icns: "icns 格式无法调整尺寸和压缩率,其他参数无效",
  ico: "ico为 windows 程序图标格式",
};

const disabledResize = computed(() =>
  resizeDisabled.includes(options.value.outputformat)
);

const showQuality = computed(
  () => !qualityDisabled.includes(options.value.outputformat)
);

// 删除图片
const deleteImg = (item: PROCESED_ITEM) => {
  const imgIndex = list.value.findIndex((item) => item.uid === item.uid);
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

const originSizeChange = (value: boolean) => {
  if (value) {
    options.value.width = 0;
    options.value.height = 0;
  }
};

const handleChange: SelectProps["onChange"] = (value) => {
  if (qualityDisabled.includes(value as unknown as string)) {
    options.value.quality = 100;
  }
};

const previewImg = (item: PROCESED_ITEM) => {
  const allResouces = previewList.value.map((item) => item.outputPath).join(",");
  localStorage.setItem("allResouces", allResouces);
  window.ipcRenderer.invoke("open-win", `preview?url=${item.outputPath}`);
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
  // singFile.uid;
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
            // 不可以直接替换
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
    // singFile.uid;
    const bufferData = await (singFile.originFileObj as File).arrayBuffer();
    fileBuffers.push({ buffer: bufferData, uid: singFile.uid });
  }
  loading.value = true;
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
</script>

<template>
  <div class="flex w-full h-full bg-zinc-100 dark:bg-zinc-800">
    <!-- 左侧上传区域 -->
    <div class="app-left w-2/3 h-full px-2 py-2 flex flex-col">
      <Upload v-model:list="list" />
      <!-- 图片列表 -->
      <div class="flex flex-col flex-1 border-box">
        <div class="w-full flex justify-between">
          <!-- 标题 -->
          <label class="zinc-label dark:text-zinc-300">{{ t('imgProcess.upload') }}</label>
          <div class="flex items-center">
            <Icon name="delete-one" @click="deleteImgALl" class="ml-2 cursor-pointer"
            strokeLinejoin="bevel" strokeLinecap="square" :size="20" />
          </div>
        </div>
        <div class="flex overflow-x-auto w-full box-border">
          <div class="flex w-max">
            <div
              class="img-item flex-col mx-2 my-2 relative inline-flex backdrop-blur-md rounded-md items-center justify-center"
              v-for="ii in previewList" :key="ii.uid">
              <div class="top-0 left-0 z-20 w-full px-2 py-1 mb-2 box-border flex flex-col backdrop-blur-md">
                <span
                  class="text-sm font-bold text-black dark:text-zinc-300 w-full overflow-ellipsis whitespace-nowrap overflow-hidden max-w-32">{{
                  ii.filename }}</span>
                <span
                  class="text-sm text-black dark:text-zinc-300 w-full overflow-ellipsis whitespace-nowrap overflow-hidden inline-flex items-center">{{
                  ii.type }} <span class="font-bold text-lg mx-2">·</span>
                  {{ ii.size }}
                  <span v-if="ii.status === 1" class="inline-flex items-center">
                    <arrow-right class="mx-2" theme="outline" size="15" :fill="ii.decrease ? '#00b96b' : '#FF523F'"
                      strokeLinejoin="bevel" strokeLinecap="square" />
                    {{ ii.handledSize }}</span></span>
              </div>
              <!-- 图片预览 -->
              <div class="img-preview relative">
                <a-image class="relative" :preview="{ visible: false }" :width="'max-content'" :height="120"
                  :src="ii.preview" alt="image">
                  <template #previewMask>
                    <Icon name="delete-one"  @click="deleteImg(ii)" class="ml-2" strokeLinejoin="bevel" strokeLinecap="square" />
                      <Icon name="preview-open"  @click="previewImg(ii)" class="ml-2"
                      strokeLinejoin="bevel" strokeLinecap="square" />
                      <Icon name="export" v-if="ii.status === 1" @click="exportIMG(ii.outputPath)" class="ml-2" theme="outline"
                      strokeLinejoin="bevel" strokeLinecap="square"/>
                  </template>
                </a-image>
                <a-tag class="absolute right-2 bottom-2 z-20" color="green" v-if="ii.status === 1">
                  {{ t('imgProcess.processed') }}
                </a-tag>
                <div
                  class="loading-mask absolute w-full h-full top-0 left-0 flex items-center justify-center backdrop-blur-sm rounded"
                  v-if="loading">
                  <a-spin />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 右侧工具栏 -->
    <div class="app-right flex-1 flex flex-col shadow pt-4">
      <div class="options flex flex-1 flex-col px-2">
        <div class="w-full flex mb-2 justify-between">
          <label class="mr-2 zinc-label mb-2 flex-1 dark:text-zinc-300">{{ t('options.originalSize') }}</label>
          <div class="pl-2">
            <a-switch v-model:checked="options.originSize" :disabled="disabledResize" @change="originSizeChange" />
          </div>
        </div>
        <div class="w-full flex mb-2 justify-between">
          <label class="mr-2 zinc-label mb-2 flex-1 dark:text-zinc-300">{{ t('options.dimensions') }}</label>
          <div class="pl-2 flex items-center">
              <a-input-number class="flex-1" v-model:value="options.width" :min="1" :disabled="options.originSize" style="width: 80px"
                :placeholder="t('options.width')" />
                <span class="mx-2 dark:text-zinc-300">X</span>
              <a-input-number  class="flex-1" v-model:value="options.height" :min="1" :disabled="options.originSize" style="width: 80px"
                :placeholder="t('options.height')" />
          </div>
        </div>
        <div class="fw-full flex mb-2 justify-between">
          <label class="mr-2 zinc-label  mb-2 flex-1 dark:text-zinc-300">{{ t('options.keepExif') }}</label>
          <div class="pl-2">
            <a-switch v-model:checked="options.keepExif" />
          </div>
        </div>
        <div class="w-full flex mb-2 justify-between">
          <label class="mr-2 zinc-label  mb-2 flex-1 dark:text-zinc-300">{{ t('options.compression') }}</label>
          <div class="pl-2">
            <a-input-number class="w-40" :disabled="!showQuality" v-model:value="options.quality" :min="1" :max="100">
              <template #addonAfter>%</template>
            </a-input-number>
          </div>
        </div>
        <div class="flex flex-col py-2">
          <div class="w-full flex mb-2 justify-between">
            <label class="mr-2 zinc-label  mb-2 flex-1 dark:text-zinc-300">{{ t('options.outputFormat') }}</label>
            <div class="pl-2">
              <a-select v-model:value="options.outputformat" class="w-40" @change="handleChange">
                <a-select-option v-for="format in supportedFormat" :key="format" :value="format">{{ format.toUpperCase()
                  }}</a-select-option>
              </a-select>
            </div>
          </div>
          <div class="notice text-xs pl-2 mt-2 text-gray-400 block"
            v-if="noticeMap[options.outputformat as keyof typeof noticeMap]">
            {{ t(`options.notice.${options.outputformat}`) }}
          </div>
        </div>
      </div>
      <div class="flex w-full py-2 shadow justify-between px-2">
        <a-button class="ml-2" @click="processIMG" type="primary">{{ t('imgProcess.batchProcess') }}</a-button>
        <a-button class="ml-2" @click="exportAll" type="primary">{{ t('imgProcess.exportAll') }}</a-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-mask {
  background: rgba(0, 0, 0, 0.1);
}

.img-item {
  background: rgba(0, 0, 0, 0.1);
}
</style>
