import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import './style.css'
import '@icon-park/vue-next/styles/index.css'
import './demos/ipc'
import IconPlugin from './icon';
import i18n from './i18n'
// If you want use Node.js, the`nodeIntegration` needs to be enabled in the Main process.
// import './demos/node'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(IconPlugin)
app.use(i18n)

app.mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*')
  })
