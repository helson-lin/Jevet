import { createI18n } from 'vue-i18n'
import en from '../locales/en'
import zh from '../locales/zh'

const i18n = createI18n({
  legacy: false, // you must set `false`, to use Composition API
  locale: localStorage.getItem('language') || 'zh', // set locale, 默认使用中文
  fallbackLocale: 'zh', // set fallback locale, 默认回退到中文
  messages: {
    en,
    zh
  }
})

export default i18n 