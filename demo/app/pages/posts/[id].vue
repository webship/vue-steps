<script setup lang="ts">
const route = useRoute()
const { data: post, error } = await useFetch(`/api/posts/${route.params.id}`)
if (error.value) {
  throw createError({ statusCode: error.value.statusCode || 404, statusMessage: 'Post not found', fatal: true })
}
useHead({ title: () => post.value?.title || 'Post' })
</script>

<template>
  <article v-if="post">
    <h1>{{ post.title }}</h1>
    <p>{{ post.body }}</p>
    <p><NuxtLink to="/posts">All posts</NuxtLink></p>
  </article>
</template>
