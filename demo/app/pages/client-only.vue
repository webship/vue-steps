<script setup lang="ts">
useHead({ title: 'Client only' })
const now = ref('')
onMounted(() => { now.value = 'rendered in the browser' })
</script>

<template>
  <section>
    <h1>Client only</h1>
    <p>This page is <span id="where">{{ now }}</span>.</p>
  </section>
</template>
