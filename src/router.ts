import {  createWebHashHistory, createRouter } from 'vue-router'
import Home from './pages/Home.vue'
import ImgProcess from './pages/ImgProcess.vue'
import Preview from './pages/Preview.vue'
const routes = [
    {
      path: '/',
      name: 'Home',
      component: Home,
    },
    {
      path: '/img',
      name: 'ImgProcess',
      component: ImgProcess
    },
    {
      path: '/preview',
      name: 'Preview',
      component: Preview
    }
  ]
  const router = createRouter({
    history: createWebHashHistory(),
    routes
  })

  export default router