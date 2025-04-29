<template>
  <div class="w-full h-full image-editor-container">
    <div
      id="tui-image-editor"
      ref="tuiImageEditor"
      class="dark:bg-zinc-800 w-full h-full rounded-lg shadow-md overflow-hidden"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { useColorMode } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import ImageEditor from "tui-image-editor";

const { t } = useI18n();
const mode = useColorMode();
const tuiImageEditor = ref(null);
let imageEditor = null;

// 监听主题模式变化
watch(
  () => mode.value,
  () => {
    if (imageEditor) {
      // 重新初始化编辑器以应用新主题
      imageEditor.destroy();
      initializeEditor();
    }
  }
);

// 初始化编辑器
const initializeEditor = () => {
  imageEditor = new ImageEditor(tuiImageEditor.value, {
    cssMaxWidth: 700,
    cssMaxHeight: 500,
    selectionStyle: {
      cornerSize: 20,
      rotatingPointOffset: 70,
    },
  });
};

onMounted(() => {
  initializeEditor();
  imageEditor.loadImageFromURL("https://storage.helson-lin.cn/3&2EC_app_icon_012.png", 'amin').then(function (sizeValue) {
  console.log(sizeValue);
  imageEditor.clearUndoStack();
});

});

onBeforeUnmount(() => {
  if (imageEditor) {
    imageEditor.destroy();
    imageEditor = null;
  }
});
</script>

<style>
.image-editor-container {
  transition: all 0.3s ease;
}
</style>
