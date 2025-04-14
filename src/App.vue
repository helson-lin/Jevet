<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter()

const jumpHome = () => router.push({ path: '/' })
</script>

<template>
  <a-config-provider
    :theme="{
      token: {
        colorPrimary: '#00b96b',
      },
    }"
  >
  <header class="w-full border-b border-slate-200/80 backdrop-blur-sm py-3 sticky top-0 z-50">
    <div class="flex items-center justify-between max-w-7xl mx-auto">
      <div class="flex items-center space-x-2 px-2">
        <span class="text-xl font-semibold bg-gradient-to-r from-green-600 to-green-600 bg-clip-text text-transparent" @click="jumpHome">Jevet</span>
      </div>
      <div class="flex items-center space-x-4">
        <button class="px-4 py-2 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors duration-200">
          <font-awesome-icon icon="far fa-question-circle" class="mr-2" />
          帮助
        </button>
      </div>
    </div>
  </header>
    <router-view class="flex-1"></router-view>  
  </a-config-provider>
</template>

<style scoped>
.loading-mask {
  background: rgba(0, 0, 0, 0.3);
}
</style>
