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

import { ref, computed, h } from "vue";
import Upload from "../components/Upload.vue";
import { message, Modal, type UploadFile, type SelectProps } from "ant-design-vue";
import {
  Export,
  PreviewOpen,
  DeleteOne,
  PlayOne,
  CheckSmall,
  ArrowRight,
  Info,
} from "@icon-park/vue-next";
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
  model: 'u2net',
  quality: 80,
  outputformat: "png",
});

const supportedModels = [
    'BEN2_Base',
    'u2net',
    'silueta',
    'u2net_human_seg',
    'u2net_cloth_seg'
]

const supportedFormat = [
  "png",
  "jpg",
  "jpeg",
  "webp"
];

const noticeMap = {
  icns: "icns 格式无法调整尺寸和压缩率,其他参数无效",
  ico: "ico为 windows 程序图标格式",
};


// 删除图片
const deleteImg = (item: PROCESED_ITEM) => {
  const imgIndex = list.value.findIndex((item) => item.uid === item.uid);
  if (imgIndex !== -1) {
    list.value.splice(imgIndex, 1);
    message.success("🎉 删除成功");
  }
};

// 删除所有的图片
const deleteImgALl = () => {
  if (list.value.length === 0) {
    message.info('没有可以删除的图片')
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
    h('span', { class: 'inline-flex text-base font-bold'}, '删除')
    ]),
    content: '确定删除所有的图片？',
    okText: '确定',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      list.value = [];
      message.success("🎉 全部清除成功");
    },
    onCancel() {},
  });
};


const previewImg = (item: PROCESED_ITEM) => {
  window.ipcRenderer.invoke("open-win", `preview?url=${item.outputPath}`);
};

const exportIMG = (filePath: string) => {
  window.ipcRenderer
    .invoke("moveToDownloads", filePath)
    .then(
      (res: { downloadsPaths: string[]; success: boolean; error?: string }) => {
        if (res.success && res.downloadsPaths?.[0]) {
          message.success(`文件转存到${res.downloadsPaths?.[0]}`);
        } else if (res.error) {
          message.error(res.error);
        }
      }
    );
};

function formatFileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
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
    message.info("没有可以导出的图片");
    return;
  }
  window.ipcRenderer
    .invoke("moveToDownloads", filePaths)
    .then(
      (res: { downloadsPaths: string[]; success: boolean; error?: string }) => {
        if (res.success && res.downloadsPaths?.[0]) {
          message.success(`🎉 批量导出成功`);
        } else if (res.error) {
          message.error(res.error);
        }
      }
    );
};

const processIMG = async () => {
  const files = list.value;
  if (files.length === 0) {
    message.info("没有需要处理的图片，上传点图片吧");
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
</script>

<template>
  <div class="flex w-full h-full bg-zinc-100">
    <!-- 左侧上传区域 -->
    <div class="app-left w-2/3 h-full px-2 py-2 flex flex-col">
      <Upload v-model:list="list" />
      <!-- 图片列表 -->
      <div class="flex flex-col flex-1 border-box">
        <div class="w-full flex justify-between">
          <!-- 标题 -->
          <label class="zinc-label">上传图片</label>
          <div class="flex items-center">
            <delete-one
              @click="deleteImgALl"
              class="ml-2 cursor-pointer"
              theme="outline"
              size="20"
              fill="#333"
              strokeLinejoin="bevel"
              strokeLinecap="square"
            />
          </div>
        </div>
        <div class="flex overflow-x-auto w-full box-border">
          <div class="flex w-max">
            <div
              class="img-item flex-col mx-2 my-2 relative inline-flex backdrop-blur-md rounded-md items-center justify-center"
              v-for="ii in previewList"
              :key="ii.uid"
            >
              <div
                class="top-0 left-0 z-20 w-full px-2 py-1 mb-2 box-border flex flex-col backdrop-blur-md"
              >
                <span
                  class="text-sm font-bold text-black w-full overflow-ellipsis whitespace-nowrap overflow-hidden max-w-32"
                  >{{ ii.filename }}</span
                >
                <span
                  class="text-sm text-black w-full overflow-ellipsis whitespace-nowrap overflow-hidden inline-flex items-center"
                  >{{ ii.type }} <span class="font-bold text-lg mx-2">·</span>
                  {{ ii.size }}
                  <span v-if="ii.status === 1" class="inline-flex items-center">
                    <arrow-right
                      class="mx-2"
                      theme="outline"
                      size="15"
                      :fill="ii.decrease ? '#00b96b' : '#FF523F'"
                      strokeLinejoin="bevel"
                      strokeLinecap="square"
                    />
                    {{ ii.handledSize }}</span
                  ></span
                >
              </div>
              <!-- 图片预览 -->
              <div class="img-preview relative">
                <a-image
                  class="relative"
                  :preview="{ visible: false }"
                  :width="'max-content'"
                  :height="120"
                  :src="ii.preview"
                  alt="image"
                >
                  <template #previewMask>
                    <!-- <play-one @click="processSingleIMG(ii)" theme="outline" size="27" fill="#fff" strokeLinejoin="bevel" strokeLinecap="square"/> -->
                    <delete-one
                      @click="deleteImg(ii)"
                      class="ml-2"
                      theme="outline"
                      size="20"
                      fill="#fff"
                      strokeLinejoin="bevel"
                      strokeLinecap="square"
                    />
                    <preview-open
                      @click="previewImg(ii)"
                      class="ml-2"
                      theme="outline"
                      size="20"
                      fill="#fff"
                      strokeLinejoin="bevel"
                      strokeLinecap="square"
                    />
                    <export
                      v-if="ii.status === 1"
                      @click="exportIMG(ii.outputPath)"
                      class="ml-2"
                      theme="outline"
                      size="20"
                      fill="#fff"
                      strokeLinejoin="bevel"
                      strokeLinecap="square"
                    />
                  </template>
                </a-image>
                <a-tag
                  class="absolute right-2 bottom-2 z-20"
                  color="green"
                  v-if="ii.status === 1"
                >
                  {{ ii.status === 1 ? "已处理" : "" }}
                </a-tag>
                <div
                  class="loading-mask absolute w-full h-full top-0 left-0 flex items-center justify-center backdrop-blur-sm rounded"
                  v-if="loading"
                >
                  <a-spin />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 右侧工具栏 -->
    <div class="app-right flex-1 flex flex-col bg-zinc-100 shadow">
      <div class="options flex flex-1 flex-col px-2">
        <div class="flex flex-col py-2">
          <div class="flex items-center">
            <label class="mr-2 zinc-label w-20">模型</label>
            <a-select
              v-model:value="options.model"
              class="w-40"
            >
              <a-select-option
                v-for="model in supportedModels"
                :key="model"
                :value="model"
                >{{ model.toUpperCase() }}</a-select-option
              >
            </a-select>
          </div>
          </div>
        <div class="flex items-center py-2">
          <label class="mr-2 zinc-label w-20">压缩</label>
          <a-input-number
            class="w-40"
            :disabled="!showQuality"
            v-model:value="options.quality"
            :min="1"
            :max="100"
          >
            <template #addonAfter>%</template>
          </a-input-number>
        </div>
        <div class="flex flex-col py-2">
          <div class="flex items-center">
            <label class="mr-2 zinc-label w-20">输出格式</label>
            <a-select
              v-model:value="options.outputformat"
              class="w-40"
              @change="handleChange"
            >
              <a-select-option
                v-for="format in supportedFormat"
                :key="format"
                :value="format"
                >{{ format.toUpperCase() }}</a-select-option
              >
            </a-select>
          </div>
          <div
            class="notice text-xs pl-2 mt-2 text-gray-400 block"
            v-if="noticeMap[options.outputformat as keyof typeof noticeMap]"
          >
            {{ noticeMap[options.outputformat as keyof typeof noticeMap] }}
          </div>
        </div>
      </div>
      <div class="flex w-full py-2 shadow justify-between px-2">
        <a-button class="ml-2" @click="processIMG" type="primary"
          >批量处理</a-button>
        <a-button class="ml-2" @click="exportAll" type="primary"
          >全部导出</a-button>
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
