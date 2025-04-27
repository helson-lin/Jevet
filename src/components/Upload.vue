<script lang="ts" setup>
import { ref, computed, defineEmits, defineProps } from "vue";
import { message } from "ant-design-vue";
import { useI18n } from 'vue-i18n';
import Icon from "./Icon.vue";

const { t } = useI18n();

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
  const isIcnsOrIco = file.name.toLowerCase().endsWith('.icns') || file.name.toLowerCase().endsWith('.ico')
  
  if (isIcnsOrIco) {
    message.error(t('upload.formatNotAllowed'));
    return false;
  }
  
  if (!isJpgOrPng) {
    message.error(t('upload.imageOnly'));
    return false;
  }
  const isLt2M = file.size / 1024 / 1024 < 100;
  if (!isLt2M) {
    message.error(t('upload.sizeLimitError'));
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
        <Icon name="upload" size="40" />
        <div class="ant-upload-text mt-4">{{ t('upload.dragText') }}</div>
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