import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import servicesPlugin from './infrastructure/http/plugins/servicesPlugin.js'
import { healthRoute } from './infrastructure/http/routes/healthRoute.js'
import { chatRoute } from './infrastructure/http/routes/chatRoute.js'
import { conversationsRoute } from './infrastructure/http/routes/conversationsRoute.js'
import { agentRoute } from './infrastructure/http/routes/agentRoute.js'
import { ragRoute } from './infrastructure/http/routes/ragRoute.js'

export async function buildApp(opts: object = {}) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined
    },
    ...opts
  })

  await app.register(sensible)
  await app.register(servicesPlugin)

  await app.register(healthRoute)
  await app.register(chatRoute)
  await app.register(conversationsRoute)
  await app.register(agentRoute)
  await app.register(ragRoute)

  return app
}