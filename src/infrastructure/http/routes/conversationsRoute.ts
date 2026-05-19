import type { FastifyInstance } from 'fastify'
import type { StreamEvent } from '../../../domain/entities/StreamEvent.js'

const sseHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no'
}

export async function conversationsRoute(app: FastifyInstance) {
  app.addSchema({ $id: 'Message', type: 'object', properties: {
    id: { type: 'integer' }, conversationId: { type: 'integer' },
    role: { type: 'string' }, content: { type: 'string' }, createdAt: { type: 'string' }
  }})

  app.addSchema({ $id: 'Conversation', type: 'object', properties: {
    id: { type: 'integer' }, title: { type: 'string' },
    createdAt: { type: 'string' }, messageCount: { type: 'integer' }
  }})

  app.post('/conversations', {
    schema: { response: { 201: { $ref: 'Conversation#' } } }
  }, async (_req, reply) => {
    return reply.status(201).send(app.conversationUseCase.create())
  })

  app.get('/conversations', {
    schema: { response: { 200: { type: 'array', items: { $ref: 'Conversation#' } } } }
  }, async () => app.conversationUseCase.findAll())

  app.get('/conversations/:id', {
    schema: { params: { type: 'object', properties: { id: { type: 'integer' } } } }
  }, async (request, reply) => {
    const { id } = request.params as { id: number }
    const result = app.conversationUseCase.findById(id)
    if (!result) return reply.status(404).send({ message: `Conversation ${id} introuvable` })
    return result
  })

  app.delete('/conversations/:id', {
    schema: { params: { type: 'object', properties: { id: { type: 'integer' } } } }
  }, async (request, reply) => {
    const { id } = request.params as { id: number }
    const deleted = app.conversationUseCase.delete(id)
    if (!deleted) return reply.status(404).send({ message: `Conversation ${id} introuvable` })
    return reply.status(204).send()
  })

  app.post('/conversations/:id/messages', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'integer' } } },
      body: {
        type: 'object', required: ['message'],
        properties: { message: { type: 'string', minLength: 1, maxLength: 4096 } },
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number }
    const { message } = request.body as { message: string }

    const conv = app.conversationUseCase.findById(id)
    if (!conv) return reply.status(404).send({ message: `Conversation ${id} introuvable` })

    const controller = new AbortController()
    request.raw.once('close', () => controller.abort())

    reply.raw.writeHead(200, sseHeaders)
    const send = (e: StreamEvent) => reply.raw.write(`data: ${JSON.stringify(e)}\n\n`)

    try {
      await app.conversationUseCase.sendMessage(id, message, send, controller.signal)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') send({ type: 'error', message: (err as Error).message })
    } finally {
      reply.raw.end()
    }
  })
}