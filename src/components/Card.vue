<script lang="ts">
import { defineComponent, ref } from "vue";
import { Pic, CuttingOne, Zoom, SmartOptimization } from "@icon-park/vue-next";
import { useRouter } from "vue-router";
export default defineComponent({
    components: {
        Pic,
        CuttingOne,
        Zoom,
        SmartOptimization
    },
    setup () {
        const list = ref<{
                name: String;
                icon: String;
                desc: String;
                path: String;
        }[]>([
            {
                name: "图片转码压缩",
                icon: "pic",
                desc: "支持多种格式转换，包括PNG、JPG、WEBP等",
                path: '/img',
            },
            {
                name: "智能抠图",
                icon: "cutting-one",
                desc: "一键抠除背景，支持人物、物品等多种场景",
                path: '/removeBg'
            },
            {
                name: "AI 扩图",
                icon: "zoom",
                desc: "一键抠除背景，支持人物、物品等多种场景",
                path: ''
            },
            {
                name: "智能修图",
                icon: "smart-optimization",
                desc: "一键抠除背景，支持人物、物品等多种场景",
                path: ''
            },
        ]);
        const router = useRouter()
        const jump = (routerPATH: string) => {
            if (!routerPATH) return;
            router.push({ path: routerPATH, query: {} })
        }
        return {
            list,
            jump
        }
    }
})
</script>
<template>
<div class="flex flex-wrap w-full py-2">
    <div
        class="flex w-1/2 px-4 my-2 pb-4"
        v-for="(item, index) in list"
        :key="index"
    >
    <div class="inner flex flex-col w-full shadow rounded-md py-2 pt-4" :class="{'bg-gray-100': !item.path, 'bg-white  hover:shadow-gray-400': item.path }" @click="jump(item.path)">
        <div class="flex items-center justify-center mb-2">
            <component :name="item.icon" :is="item.icon" size="40" :fill="['#05A17E' ,'#ffffff']" strokeLinejoin="bevel" strokeLinecap="square"></component>
        </div>
        <div class="flex items-center justify-center my-2">
            <span class="text-lg font-bold">{{ item.name }}</span>
        </div>
        <div class="flex justify-center text-base my-2 text-gray-600">
            {{ item.desc }}
        </div>
    </div>
    </div>
</div>
</template>
