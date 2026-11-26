// The posts of the demo, kept in the server's code: a list for /posts and one post for /posts/<id>.
export const POSTS = [
  { id: 1, title: 'First steps', body: 'A page loaded from the server, then taken over in the browser.' },
  { id: 2, title: 'Moving between pages', body: 'A link inside the app loads the next page without a whole page load.' },
  { id: 3, title: 'Forms', body: 'A form sent inside the page with JavaScript, and posted without it.' },
]

export default defineEventHandler(() => POSTS.map(({ id, title }) => ({ id, title })))
