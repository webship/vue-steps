// The contact form: JSON from the page's own fetch, or a form posted without JavaScript, which is sent back to the
// page with the answer in its address.
export default defineEventHandler(async (event) => {
  const type = getRequestHeader(event, 'content-type') || ''
  const fromForm = type.includes('application/x-www-form-urlencoded')
  const body = fromForm ? await readFormData(event).then((f) => Object.fromEntries(f)) : await readBody(event)
  const name = String((body && body.name) || '').trim()
  const message = String((body && body.message) || '').trim()
  const error = !name ? 'Your name is required.' : (message.length < 10 ? 'Your message needs at least 10 characters.' : '')
  if (fromForm) {
    const query = error ? `error=${encodeURIComponent(error)}` : `sent=${encodeURIComponent(name)}`
    return sendRedirect(event, `/contact?${query}`, 303)
  }
  if (error) {
    setResponseStatus(event, 422)
    return { error }
  }
  return { ok: true, name }
})
