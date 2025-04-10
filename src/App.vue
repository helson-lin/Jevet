<script setup lang="ts">
interface SHARP_RESULT {
  outputPath: string; 
  base64Image: string; 
  preview: string;
  uid: string;
}

interface PROCESED_ITEM {
  uid: string;
  status: 0 | 1 | 2;
  outputPath: string; 
  preview: string;
  base64Image: string; 
}

import { ref, computed } from "vue";
import Upload from "./components/Upload.vue";
import { message, type UploadFile } from "ant-design-vue";
import { Export, PreviewOpen, DeleteOne } from "@icon-park/vue-next";
const list = ref<UploadFile[]>([]);
const loading = ref(false);
const processImgs = ref<SHARP_RESULT[]>([]);
const previewList = computed(() => {
  return list.value.reduce<PROCESED_ITEM[]>((pre, val) => {
            const isInResult = processImgs.value.find(result => result.uid === val.uid)
            if (!isInResult) {
              pre.push({
                uid: val.uid,
                status: 2,
                outputPath: '',
                preview: URL.createObjectURL((val.originFileObj as File)),
                base64Image: '',
              })
            } else {
              pre.push({
                uid: val.uid,
                status: 1,
                outputPath: isInResult.outputPath,
                preview: URL.createObjectURL((val.originFileObj as File)),
                base64Image: isInResult?.base64Image,
              })
            }
            return pre;
          }, []);
})

const options = ref<{
  width: number;
  height: number;
  keepExif: boolean;
  outputformat: string;
}>({
  width: 0,
  height: 0,
  keepExif: false,
  outputformat: 'webp',
})

const supportedFormat = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'jp2', 'tiff' , 'heif']

const deleteImg = (item: PROCESED_ITEM) => {
  const imgIndex = list.value.findIndex(item => item.uid === item.uid);
  if (imgIndex !== -1) {
    list.value.splice(imgIndex, 1)
    message.success('删除成功')
  }
}

const previewImg = () => {}

const processIMG = async () => {
  const files = list.value;
  const fileBuffers = [];
  for (const singFile of files) {
    // singFile.uid;
    const bufferData = await (singFile.originFileObj as File).arrayBuffer();
    fileBuffers.push({ buffer: bufferData, uid: singFile.uid });
  }
  loading.value = true
  try {
    console.log('🚀', options.value, fileBuffers)
    window.ipcRenderer
      .invoke("pi", {
        imgs: fileBuffers,
        options: options.value,
      })
      .then((data: { success: boolean; results: SHARP_RESULT[];  error?: string;}) => {
        console.log('✅', data)
        loading.value = false
        if (data.success && data.results) {
            processImgs.value = data.results
        } else {
          if (data.error) message.warning(data.error)
        }
      }).catch(e => {
        loading.value = false
        message.error(e.message)
      });
  } catch (e: any) {
      loading.value = false
      message.error(e.message)
  }
};
</script>

<template>
  <div class="flex w-full h-full bg-zinc-100">
    <div class="app-left w-2/3 h-full px-2 py-2">
      <Upload v-model:list="list" />
      <div class="flex flex-wrap">
        <div class="w-full zinc-label">
          上传图片
        </div>
        <div class="img-item px-2 py-2 relative"  v-for="ii in previewList" :key="ii.uid" >
          <a-image :preview="{visible: false }" :height="100" :width="100" :src="ii.preview" alt="image" >
            <template #previewMask> 
              <delete-one @click="deleteImg(ii)" class="ml-2" theme="outline" size="20" fill="#fff" strokeLinejoin="bevel" strokeLinecap="square"/>
              <preview-open @click="previewImg(ii)" class="ml-2" theme="outline" size="20" fill="#fff" strokeLinejoin="bevel" strokeLinecap="square"/>
              <export v-if="ii.status === 1" class="ml-2" theme="outline" size="20" fill="#fff" strokeLinejoin="bevel" strokeLinecap="square"/>
            </template>
          </a-image>
          <a-tag class="absolute right-2 top-2" color="green" v-if="ii.status === 1 ">{{ ii.status === 1 ? '已处理' : '' }}</a-tag>
          <div class="loading-mask absolute w-full h-full top-0 left-0 flex items-center justify-center backdrop-blur-sm rounded" v-if="loading">
            <a-spin />
          </div>
        </div>
      </div>
    </div>
    <div class="app-right flex-1 flex flex-col py-2 bg-zinc-100 shadow">
     <div class="options flex flex-1 flex-col px-2">
      <div class="flex items-center py-2">
        <label class="mr-2 zinc-label">宽高</label>
        <a-input-number  v-model:value="options.width" :min="1" style="width:50px"/>
        <span class="ml-2 mr-2">X</span>
        <a-input-number  v-model:value="options.height" :min="1" style="width:50px"/>
      </div>
      <div class="flex items-center py-2 ">
        <label class="mr-2 zinc-label">EXIF保留</label>
        <a-switch v-model:checked="options.keepExif" />
      </div>
      <div class="flex items-center py-2 ">
        <label class="mr-2 zinc-label">输出格式</label>
        <a-select
          v-model:value="options.outputformat"
          style="width: 120px"
          @focus="focus"
          @change="handleChange"
        >
          <a-select-option v-for="format in supportedFormat" :key="format" :value="format">{{ format.toUpperCase() }}</a-select-option>
        </a-select>
      </div>
     </div>
      <div class="flex w-full py-2 shadow bg-slate-200">   
        <a-button class="ml-2" @click="processIMG" type="primary">处理</a-button>
        <a-button class="ml-2" @click="processIMG" type="primary">全部导出</a-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-mask {
  background: rgba(0, 0, 0, 0.3);
}
</style>
