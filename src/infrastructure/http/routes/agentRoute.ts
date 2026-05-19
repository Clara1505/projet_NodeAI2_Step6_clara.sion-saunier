import type { FastifyInstance } from 'fastify'
import type { StreamEvent } from '../../../domain/entities/StreamEvent.js'

const sseHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no'
}

export async function agentRoute(app: FastifyInstance) {
  app.post('/chat/agent', {
    schema: {
      body: {
        type: 'object', required: ['message'],
        properties: { message: { type: 'string', minLength: 1, maxLength: 4096 } },
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { message } = request.body as { message: string }

    const controller = new AbortController()
    request.socket.once('close', () => controller.abort())

    reply.raw.writeHead(200, sseHeaders)
    const send = (e: StreamEvent) => reply.raw.write(`data: ${JSON.stringify(e)}\n\n`)

    try {
      await app.agentUseCase.run(message, send, controller.signal)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') send({ type: 'error', message: (err as Error).message })
    } finally {
      request.socket.removeAllListeners('close')
      reply.raw.end()
    }
  })
}