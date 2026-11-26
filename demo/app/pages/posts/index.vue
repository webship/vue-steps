<script setup lang="ts">
useHead({ title: 'Posts' })
const { data: posts, refresh, status } = await useFetch('/api/posts')
</script>

<template>
  <section>
    <h1>Posts</h1>
    <ul>
      <li v-for="post in posts" :key="post.id">
        <NuxtLink :to="`/posts/${post.id}`">{{ post.title }}</NuxtLink>
      </li>
    </ul>
    <p><NuxtLink to="/posts/latest">The latest post</NuxtLink></p>
    <button type="button" @click="refresh()">Load the posts again</button>
    <p>Status: <span id="status">{{ status }}</span></p>
  </section>
</template>
