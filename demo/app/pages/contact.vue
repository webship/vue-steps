<script setup lang="ts">
// The form works without JavaScript (posted to the server route, which sends the page back with the answer in its
// address) and, once the app has taken the page over, is sent inside the page.
useHead({ title: 'Contact' })
const route = useRoute()
const name = ref('')
const message = ref('')
const sent = ref(typeof route.query.sent === 'string' ? route.query.sent : '')
const error = ref(typeof route.query.error === 'string' ? route.query.error : '')
const sending = ref(false)

async function send() {
  sending.value = true
  error.value = ''
  sent.value = ''
  try {
    const answer = await $fetch<{ ok: boolean, name: string }>('/api/contact', { method: 'POST', body: { name: name.value, message: message.value } })
    sent.value = answer.name
  } catch (e: any) {
    error.value = (e && e.data && e.data.error) || 'The message could not be sent.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section>
    <h1>Contact</h1>
    <form method="post" action="/api/contact" @submit.prevent="send">
      <p>
        <label for="name">Your name</label>
        <input id="name" v-model="name" name="name" type="text">
      </p>
      <p>
        <label for="message">Your message</label>
        <textarea id="message" v-model="message" name="message" />
      </p>
      <button type="submit" :disabled="sending">Send</button>
    </form>
    <p v-if="sent" role="status">Thanks, {{ sent }}: your message was sent.</p>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
