<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute();
const previewURL =  computed(() => {
    const url: any = route.query.url
    if (url.startsWith('blob')) {
        return url;
    } else {
        return `file://${url}`
    }
})
const previewList = ref<string[]>([])

// 监听 close 按钮的点击
function listen () {
    const antClose = document.querySelector('.anticon-close')
    antClose && antClose.addEventListener('click', () => {
        // 关闭当前窗口
        window.ipcRenderer.invoke('close-win');
    })
}
// 设置显示隐藏
const setVisible = () => {}
</script>
<template>
    <div class="w-full h-full">
        <a-image :src="previewURL" :style="{ display: 'none' }"
        :preview="{
            visible: true,
            onVisibleChange: setVisible,
        }">
            <template #preview>

            </template>
        </a-image>
    </div>
</template>
<style scoped>
</style>