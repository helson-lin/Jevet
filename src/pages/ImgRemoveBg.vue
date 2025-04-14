<script setup lang="ts">
import Upload from "../components/Upload.vue";
import { ref } from "vue";
import { type UploadFile} from "ant-design-vue";
const list = ref<UploadFile[]>([]);
</script>
<template>
    <div class="flex w-full h-full bg-zinc-100 px-2 py-2">
        <upload v-model:list="list"/>
    </div>
</template>

