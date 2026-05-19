import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { createDatabase } from '../../db/createDatabase.js'
import { SqliteConversationRepository } from '../../db/SqliteConversationRepository.js'
import { SqliteMessageRepository } from '../../db/SqliteMessageRepository.js'
import { SqliteChunkRepository } from '../../db/SqliteChunkRepository.js'
import { OllamaGateway } from '../../llm/OllamaGateway.js'
import { ToolExecutorAdapter } from '../../tools/ToolExecutorAdapter.js'
import { FileSystemDocumentLoader } from '../../rag/FileSystemDocumentLoader.js'
import { MarkdownChunker } from '../../../domain/services/MarkdownChunker.js'
import { ChatUseCase } from '../../../application/usecases/ChatUseCase.js'
import { ConversationUseCase } from '../../../application/usecases/ConversationUseCase.js'
import { AgentUseCase } from '../../../application/usecases/AgentUseCase.js'
import { RagUseCase } from '../../../application/usecases/RagUseCase.js'
import { IndexDocsUseCase } from '../../../application/usecases/IndexDocsUseCase.js'

declare module 'fastify' {
  interface FastifyInstance {
    chatUseCase: ChatUseCase
    conversationUseCase: ConversationUseCase
    agentUseCase: AgentUseCase
    ragUseCase: RagUseCase
    indexDocsUseCase: IndexDocsUseCase
  }
}

async function servicesPlugin(app: FastifyInstance) {
  const OLLAMA_URL  = process.env.OLLAMA_URL   ?? 'http://localhost:11434'
  const MODEL       = process.env.OLLAMA_MODEL ?? 'llama3.2'
  const EMBED_MODEL = process.env.EMBED_MODEL  ?? 'nomic-embed-text'

  const db = createDatabase(process.env.DB_PATH)

  const convRepo  = new SqliteConversationRepository(db)
  const msgRepo   = new SqliteMessageRepository(db)
  const chunkRepo = new SqliteChunkRepository(db)
  const llm       = new OllamaGateway(OLLAMA_URL, MODEL, EMBED_MODEL)
  const tools     = new ToolExecutorAdapter()
  const loader    = new FileSystemDocumentLoader()
  const chunker   = new MarkdownChunker()

  app.decorate('chatUseCase',         new ChatUseCase(llm))
  app.decorate('conversationUseCase', new ConversationUseCase(convRepo, msgRepo, llm))
  app.decorate('agentUseCase',        new AgentUseCase(llm, tools))
  app.decorate('ragUseCase',          new RagUseCase(llm, chunkRepo))
  app.decorate('indexDocsUseCase',    new IndexDocsUseCase(loader, chunker, llm, chunkRepo))

  app.addHook('onClose', () => db.close())

  app.addHook('onReady', async () => {
    const count = chunkRepo.count()
    if (count === 0) {
      app.log.info('RAG: aucun chunk en base, indexation des documents...')
      try {
        const { files, chunks } = await app.indexDocsUseCase.execute()
        app.log.info(`RAG: Indexed ${chunks} chunks from ${files} files`)
      } catch (err) {
        app.log.warn({ err: (err as Error).message }, 'RAG: indexation échouée (docs vides ou Ollama indisponible)')
      }
    } else {
      app.log.info(`RAG: ${count} chunks déjà indexés`)
    }
  })
}

export default fp(servicesPlugin, { name: 'services' })