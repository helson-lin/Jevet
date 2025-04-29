<script setup lang="ts">
import { ref, computed } from "vue";
import { Pic, CuttingOne, Zoom, SmartOptimization } from "@icon-park/vue-next";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const router = useRouter();

const list = computed(() => [
    {
        name: t("home.imageCompression"),
        icon: "pic",
        desc: t("home.imageCompressionDesc"),
        path: '/img',
    },
    {
        name: t("home.smartCutout"),
        icon: "cutting-one",
        desc: t("home.smartCutoutDesc"),
        path: '/removeBg'
    },
    {
        name: t("home.aiExpand"),
        icon: "zoom",
        desc: t("home.aiExpandDesc"),
        path: ''
    },
    {
        name: t("home.smartRetouch"),
        icon: "smart-optimization",
        desc: t("home.smartRetouchDesc"),
        path: ''
    },
]);
const jump = (routerPATH: string) => {
    if (!routerPATH) return;
    router.push({ path: routerPATH, query: {} })
}
</script>
<template>
<div class="flex flex-wrap w-full py-2">
    <div
        class="flex w-1/2 px-4 my-2 pb-4"
        v-for="(item, index) in list"
        :key="index"
    >
    <div class="inner flex flex-col w-full shadow rounded-md py-2 pt-4" :class="{'bg-gray-200': !item.path, 'bg-white  hover:shadow-gray-400': item.path }" @click="jump(item.path)">
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
