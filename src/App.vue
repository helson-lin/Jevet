<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { Github, SettingTwo, Translation } from '@icon-park/vue-next';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import enUS from 'ant-design-vue/es/locale/en_US';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const route = useRoute()
const router = useRouter()
const { locale: i18nLocale } = useI18n()
const locale = ref(localStorage.getItem('language') === 'en' ? enUS : zhCN)
const currentLang = ref(localStorage.getItem('language') || 'zh')

const openGithub = () => {
  // 使用浏览器打开 github
  const githubUrl = 'https://github.com/helson-lin/Jevet';
  window.ipcRenderer.invoke('open-external-url', githubUrl);
}

// 打开设置
const openSetting = () => {
  router.push({ path: '/setting' })
}

// 切换语言
const toggleLanguage = () => {
  if (currentLang.value === 'zh') {
    locale.value = enUS;
    currentLang.value = 'en';
    i18nLocale.value = 'en';
  } else {
    locale.value = zhCN;
    currentLang.value = 'zh';
    i18nLocale.value = 'zh';
  }
  localStorage.setItem('language', currentLang.value);
}

const jumpHome = () => router.push({ path: '/' })
</script>

<template>
  <a-config-provider
    :locale="locale"
    :theme="{
      token: {
        colorPrimary: '#00b96b',
      },
    }"
  >
  <header class="w-full border-b border-slate-200/80 backdrop-blur-sm px-4 py-1 sticky top-0 z-50" v-if="route.path !== '/preview'">
    <div class="flex items-center justify-between max-w-7xl mx-auto">
      <div class="flex items-center space-x-2">
        <span class="text-xl font-semibold bg-gradient-to-r from-green-600 to-green-600 bg-clip-text text-transparent" @click="jumpHome">Jevet</span>
      </div>
      <div class="flex items-center space-x-4">
        <button class="py-2 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors duration-200" @click="toggleLanguage">
          <translation theme="outline" size="24" fill="#333"/>
        </button>
        <!-- <button class="py-2 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors duration-200" @click="openGithub">
          <github theme="outline" size="24" fill="#333"/>
        </button> -->
        <button class="py-2 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors duration-200" @click="openSetting">
          <setting-two theme="outline" size="24" fill="#333"/>
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
