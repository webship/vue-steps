<script setup lang="ts">
// The latest post has no address of its own: a route middleware sends /posts/latest on to it. Inside the app the
// router follows the redirect; without JavaScript the server answers it with a redirect.
definePageMeta({
  middleware: () => navigateTo('/posts/3'),
})
</script>

<template>
  <p>Taking you to the latest post.</p>
</template>
