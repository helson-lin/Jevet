<script setup>
import { defineProps, useAttrs } from 'vue'
import { useColorMode } from '@vueuse/core';
const mode = useColorMode() 
defineProps({
    name: String,
    dark: {
        type: String,
        default: '#A4A4A4'
    },
    light: {
        type: String,
        default: '#333'
    }
})
const attrs = useAttrs();
</script>
<template>
    <component :is="name" v-bind="$attrs" theme="outline" :fill="mode == 'dark' ? dark : light"></component>
</template>