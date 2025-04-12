import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
import '@icon-park/vue-next/styles/index.css'
import './demos/ipc'
// If you want use Node.js, the`nodeIntegration` needs to be enabled in the Main process.
// import './demos/node'

const app = createApp(App)
app.use(router)
app .mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*')
  })
