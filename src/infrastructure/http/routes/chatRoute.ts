import type { FastifyInstance } from 'fastify'
import type { StreamEvent } from '../../../domain/entities/StreamEvent.js'

const sseHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no'
}

const bodySchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', minLength: 1, maxLength: 4096 }
  },
  additionalProperties: false
}

export async function chatRoute(app: FastifyInstance) {
  // POST /chat — réponse complète
  app.post('/chat', {
    schema: {
      body: bodySchema,
      response: { 200: { type: 'object', properties: { response: { type: 'string' } } } }
    }
  }, async (request) => {
    const { message } = request.body as { message: string }
    const response = await app.chatUseCase.chat(message)
    return { response }
  })

  // POST /chat/stream — SSE
  app.post('/chat/stream', {
    schema: { body: bodySchema }
  }, async (request, reply) => {
    const { message } = request.body as { message: string }
    const controller = new AbortController()
    request.raw.once('close', () => controller.abort())

    reply.raw.writeHead(200, sseHeaders)
    const send = (e: StreamEvent) => reply.raw.write(`data: ${JSON.stringify(e)}\n\n`)

    try {
      await app.chatUseCase.chatStream(message, send, controller.signal)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') send({ type: 'error', message: (err as Error).message })
    } finally {
      reply.raw.end()
    }
  })
}