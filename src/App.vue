<script setup lang="ts">
</script>

<template>
  <a-config-provider
    :theme="{
      token: {
        colorPrimary: '#00b96b',
      },
    }"
  >
  <router-view></router-view>
  </a-config-provider>
</template>

<style scoped>
.loading-mask {
  background: rgba(0, 0, 0, 0.3);
}
</style>
