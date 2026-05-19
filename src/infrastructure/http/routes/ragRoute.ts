import type { FastifyInstance } from 'fastify'
import type { StreamEvent } from '../../../domain/entities/StreamEvent.js'

const sseHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no'
}

export async function ragRoute(app: FastifyInstance) {
  app.post('/rag/reindex', async (request) => {
    request.log.info('RAG: réindexation manuelle déclenchée')
    const { files, chunks } = await app.indexDocsUseCase.execute()
    return { indexed: true, files, chunks }
  })

  app.post('/rag/search', {
    schema: {
      body: {
        type: 'object', required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1 },
          k: { type: 'integer', minimum: 1, maximum: 10, default: 4 }
        },
        additionalProperties: false
      }
    }
  }, async (request) => {
    const { query, k = 4 } = request.body as { query: string; k?: number }
    const results = await app.ragUseCase.search(query, k)
    return results.map(r => ({
      source: r.source,
      section: r.section,
      content: r.content,
      similarity: Math.round(r.similarity * 1000) / 1000
    }))
  })

  app.post('/chat/rag', {
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
      await app.ragUseCase.chatStream(message, send, controller.signal)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') send({ type: 'error', message: (err as Error).message })
    } finally {
      reply.raw.end()
    }
  })
}