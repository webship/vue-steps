<script setup lang="ts">
useHead({ title: 'Home' })
const count = ref(0)
</script>

<template>
  <section>
    <h1>Welcome to the demo</h1>
    <p>A Nuxt app with pages of its own: posts loaded from the server, a contact form, and a page rendered in the browser only.</p>
    <p>
      <button type="button" aria-label="Add one to the count" @click="count++">+1</button>
      <span>Count: <strong id="count">{{ count }}</strong></span>
    </p>
  </section>
</template>
