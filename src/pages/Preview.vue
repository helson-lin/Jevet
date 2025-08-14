<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowRight, Close } from '@icon-park/vue-next'
import Icon from '../components/Icon.vue'
import { useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const imageLoading = ref(true)

const previewURL = computed(() => {
    const url: any = route.query.url
    if (url?.startsWith('blob:')) {
        return url;
    } else {
        return `file://${url}`
    }
})

const outputURL = computed(() => {
    const url: any = route.query.output
    return `file://${url}`
})

// 图片加载完成处理
const onImageLoad = () => {
    imageLoading.value = false
}

// 关闭窗口
const closeWindow = () => {
    window.ipcRenderer.invoke('close-win')
}

// 监听键盘事件
const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
        closeWindow()
    }
}

onMounted(() => {
    // 添加键盘监听
    window.addEventListener('keydown', handleKeydown)
    // 图片预加载
    setTimeout(() => {
        imageLoading.value = false
    }, 1000)
})

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="preview-container w-full h-full bg-white dark:bg-zinc-900">
    <!-- 头部标题栏 -->
    <div class="header-bar flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
      <h1 class="text-lg font-medium text-gray-700 dark:text-zinc-300">
        {{ t('preview.comparison') }}
      </h1>
      <div class="flex items-center space-x-2">
        <a-button 
          type="text" 
          shape="circle" 
          @click="closeWindow"
          class="hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors duration-200"
        >
          <template #icon>
            <close theme="outline" size="16" fill="currentColor" />
          </template>
        </a-button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="content-area flex items-center justify-center px-8 py-6">
      <!-- 加载状态 -->
      <div v-if="imageLoading" class="flex flex-col items-center justify-center space-y-4">
        <a-spin size="large" />
        <p class="text-gray-600 dark:text-zinc-400">{{ t('preview.loading') }}</p>
      </div>

      <!-- 图片对比区域 -->
      <div v-else class="comparison-wrapper flex items-center justify-center w-full max-w-5xl mx-auto">
        <!-- 原始图片 -->
        <div class="image-section flex-1 max-w-lg">
          <div class="image-container relative bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4 transition-all duration-200 hover:border-gray-300 dark:hover:border-zinc-600">
            <div class="image-wrapper relative overflow-hidden rounded">
              <a-image 
                :src="previewURL"
                class="w-full h-auto max-h-80 object-contain"
                :preview="{ mask: false }"
                @load="onImageLoad"
                fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f5f5f5'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23999' font-family='Arial, sans-serif' font-size='14'%3E图片加载失败%3C/text%3E%3C/svg%3E"
              />
              <!-- 图片标签 -->
              <div class="image-label absolute top-2 left-2 bg-gray-600 dark:bg-zinc-600 text-white px-2 py-1 rounded text-xs font-medium">
                {{ t('preview.originalImage') }}
              </div>
            </div>
          </div>
        </div>

        <!-- 中间箭头区域 -->
        <div class="arrow-section flex flex-col items-center justify-center mx-4">
          <div class="flex items-center space-x-2">
            <div class="w-8 h-px bg-gray-300 dark:bg-zinc-600"></div>
            <div class="arrow-wrapper flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded">
              <arrow-right theme="filled" size="14" fill="#00b96b" />
            </div>
            <div class="w-8 h-px bg-gray-300 dark:bg-zinc-600"></div>
          </div>
          <p class="mt-2 text-xs text-gray-600 dark:text-zinc-400 text-center">
            {{ t('preview.processedImage') }}
          </p>
        </div>

        <!-- 处理结果图片 -->
        <div class="image-section flex-1 max-w-lg">
          <div class="image-container relative bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4 transition-all duration-200 hover:border-gray-300 dark:hover:border-zinc-600">
            <div class="image-wrapper relative overflow-hidden rounded">
              <a-image 
                :src="outputURL"
                class="w-full h-auto max-h-80 object-contain"
                :preview="{ mask: false }"
                fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f5f5f5'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23999' font-family='Arial, sans-serif' font-size='14'%3E处理结果%3C/text%3E%3C/svg%3E"
              />
              <!-- 图片标签 -->
              <div class="image-label absolute top-2 left-2 bg-green-600 dark:bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">
                {{ t('preview.processedImage') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部提示 -->
    <div class="footer-tip text-center py-4 border-t border-gray-200 dark:border-zinc-700">
      <p class="text-xs text-gray-600 dark:text-zinc-400">
        按 <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded text-xs">ESC</kbd> 键关闭窗口
      </p>
    </div>
  </div>
</template>

<style scoped>
.preview-container {
  height: 100vh;
}

.content-area {
  min-height: calc(100vh - 140px); /* 减去头部和底部高度 */
}

.image-wrapper /deep/ .ant-image {
    background-image: url('../assets/img/3623f49a093c354a.svg');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .comparison-wrapper {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .arrow-section {
    margin: 0.5rem 0;
  }
  
  .arrow-section > div {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .arrow-section > div > div:first-child,
  .arrow-section > div > div:last-child {
    width: 2px;
    height: 16px;
  }
  
  .arrow-section .arrow-wrapper {
    transform: rotate(90deg);
  }
  
  .image-section {
    max-width: 100%;
  }
}
</style>