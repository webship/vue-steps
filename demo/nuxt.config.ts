// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  // One page rendered in the browser only: the server sends the app's shell, and nothing of the page.
  routeRules: {
    '/client-only': { ssr: false },
  },
})
