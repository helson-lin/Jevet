<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute();
const previewURL =  computed(() => route.query.url)
const previewList = ref<string[]>([])
onMounted(() => {
    const data = localStorage.getItem('allResouces')
    if (!data) return;
    const list = data.split(',')
    previewList.value = list as string[]
})
// 设置显示隐藏
const setVisible = () => {}
</script>
<template>
    <div class="w-full h-full">
        <a-image :src="`file://${previewURL}`" :style="{ display: 'none' }"
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