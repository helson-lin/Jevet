import {  createWebHashHistory, createRouter } from 'vue-router'
import ImgProcess from './pages/ImgProcess.vue'
import ImgRemoveBg from './pages/ImgRemoveBg.vue'
import Preview from './pages/Preview.vue'
import Setting from './pages/Setting.vue'
import LogViewer from './pages/LogViewer.vue'
const routes = [
    {
      path: '/',
      redirect: '/img'
    },
    {
      path: '/img',
      name: 'ImgProcess',
      component: ImgProcess
    },
    {
      path: '/removeBg',
      name: 'RemoveBg',
      component: ImgRemoveBg
    },
    {
      path: '/preview',
      name: 'Preview',
      component: Preview
    },
    {
      path: '/setting',
      name: 'Setting',
      component: Setting,
    },
    {
      path: '/logs',
      name: 'LogViewer',
      component: LogViewer,
    }
  ]
  const router = createRouter({
    history: createWebHashHistory(),
    routes
  })

  export default router