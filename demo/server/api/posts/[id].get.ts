import { POSTS } from '../posts.get'

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  const post = POSTS.find((p) => p.id === id)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  return post
})
