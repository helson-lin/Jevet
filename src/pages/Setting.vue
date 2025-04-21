<script setup>
import { ref } from 'vue';
const options = ref({
    model: '/'
})
</script>
<template>
    <div class="setting">
        <div class="flex items-center px-4 py-2">
            <label for="model" class="w-20">模型目录</label>
            <a-input v-model:value="options.model" placeholder="Basic usage" />
        </div>
    </div>
</template>