import { createI18n } from 'vue-i18n'
import en from '../locales/en'
import zh from '../locales/zh'

const i18n = createI18n({
  legacy: false, // you must set `false`, to use Composition API
  locale: localStorage.getItem('language') || 'en', // set locale
  fallbackLocale: 'en', // set fallback locale
  messages: {
    en,
    zh
  }
})

export default i18n 