<script lang="ts" setup>
import { ref, computed, defineEmits, defineProps } from "vue";
import { message } from "ant-design-vue";
import type { UploadChangeParam, UploadProps } from 'ant-design-vue';
import { PlusOutlined, LoadingOutlined } from "@ant-design/icons-vue";
import {  Upload } from '@icon-park/vue-next'

const props = defineProps({
    list: {
        type: Array,
        require: true
    }
})

const emit = defineEmits(['update:list'])
const fileList = computed({
 set (value) {
    emit('update:list', value)
 },
 get () {
    return props.list;
 }
});
const loading = ref<boolean>(false);

const beforeUpload = (file: any) => {
  const isJpgOrPng = file.type.startsWith('image')
  if (!isJpgOrPng) {
    message.error('You can only upload image file!');
    return false;
  }
  const isLt2M = file.size / 1024 / 1024 < 100;
  if (!isLt2M) {
    message.error('Image must smaller than 100MB!');
    return false;
  }
  // todo: upload
  return false;
};
</script>

<template>
  <div class="w-full flex py-2 justify-center">
    <a-upload-dragger
      v-model:file-list="fileList"
      :show-upload-list="false"
      accept="image/*" 
      :multiple="true"
      :before-upload="beforeUpload"
    >
      <div class="w-full h-48 flex flex-col items-center justify-center">
        <loading-outlined v-if="loading"></loading-outlined>
        <upload v-else theme="outline" size="40" fill="#333" strokeLinejoin="bevel" strokeLinecap="square"/>
        <div class="ant-upload-text mt-4">拖拽文件到这里或者点击上传</div>
      </div>
    </a-upload-dragger>
  </div>
</template>
<style scoped>
.ant-upload {
    width: 100%;
}
::v-deep(.ant-upload-wrapper) {
    width: 100%;
}

::v-deep(.ant-upload.ant-upload-select.ant-upload-select-text) {
    width: 100%;
}
</style>