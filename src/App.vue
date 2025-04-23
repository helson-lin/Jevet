<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import enUS from 'ant-design-vue/es/locale/en_US';
import { theme } from 'ant-design-vue';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useColorMode } from '@vueuse/core';
import { useStore  } from './store/index'
import Icon from './components/Icon.vue';

const mode = useColorMode()
const route = useRoute()
const router = useRouter()
const store = useStore()
const { locale: i18nLocale } = useI18n()
const locale = ref(enUS)
const currentLang = ref('en')
const menu: {
  iconName: string;
  click: Function;
}[] = [{
  iconName: 'pic',
  click: () => {
    router.push({ path: '/img' })
  }
}, {
  iconName: 'CuttingOne',
  click: () => {
    router.push({ path: '/removeBg' })
  }
}]



onMounted(async () => {
  const success  = await store.getConfig()
  if (success) {
      locale.value = store.language === 'en' ? enUS : zhCN
      currentLang.value = store.language
      mode.value = store.theme
      console.warn('mounted')
  }
})

const setDark = () => { 
  if (mode.value === 'dark') mode.value = 'light' 
  else mode.value = 'dark'
}

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
    class="flex"
    :theme="{
      algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: '#00b96b',
      },
    }"
  >
  <div class="flex w-14  bg-white dark:bg-zinc-900  backdrop-blur-sm px-4 py-1 sticky top-0 z-50" v-if="route.path !== '/preview'">
    <div class="flex flex-col justify-between h-full w-full">
      <!-- <div class="flex">
        <span class="text-xl font-semibold bg-gradient-to-r from-green-600 to-green-600 bg-clip-text text-transparent" @click="jumpHome">2</span>
      </div> -->
      <!-- 快捷按钮 -->
      <div class="w-full flex flex-col flex-1 items-center py-2">
        <div class="mb-2 hover:rounded-full w-8 h-8 hover:bg-gray-300 dark:hover:bg-zinc-800 flex items-center justify-center"
        v-for="menuItem in menu" :key="menu.iconName" @click="menuItem.click()">
          <Icon :name="menuItem.iconName" :size="20" />
        </div>
      </div>
      <!-- 底部部分按钮 -->
      <div class="flex flex-col py-4">
        <button class="rounded-full mb-2 w-8 h-8 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-200" @click="openGithub">
          <Icon name="github" :size="20" />
        </button>
        <button class="rounded-full mb-2 w-8 h-8 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-200" @click="setDark">
          <Icon name="moon" :size="20" />
        </button>
        <button class="rounded-full mb-2 w-8 h-8 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-200" @click="toggleLanguage">
          <Icon name="translation" :size="20" />
        </button>
        <button class="rounded-full mb-2 w-8 h-8 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-200" @click="openSetting">
          <Icon name="setting-two" :size="20" />
        </button>
      </div>
    </div>
  </div>
  <div class="flex-1 h-full">
    <router-view></router-view>  
  </div>
  </a-config-provider>
</template>

<style scoped>
.loading-mask {
  background: rgba(0, 0, 0, 0.3);
}
</style>
