import type { ILlmGateway } from '../../domain/ports/ILlmGateway.js'
import type { IChunkRepository } from '../../domain/ports/IChunkRepository.js'
import type { IDocumentLoader, IDocumentChunker } from '../../domain/ports/IDocumentPorts.js'

export class IndexDocsUseCase {
  constructor(
    private readonly loader: IDocumentLoader,
    private readonly chunker: IDocumentChunker,
    private readonly llm: ILlmGateway,
    private readonly chunkRepo: IChunkRepository
  ) {}

  async execute(): Promise<{ files: number; chunks: number }> {
    const docs = await this.loader.loadAll()
    this.chunkRepo.deleteAll()

    let totalChunks = 0
    for (const doc of docs) {
      const chunks = this.chunker.chunk(doc.content, doc.filename)
      for (const chunk of chunks) {
        const embedding = await this.llm.embed(chunk.content)
        this.chunkRepo.insert(chunk.source, chunk.section, chunk.position, chunk.content, embedding)
        totalChunks++
      }
    }

    return { files: docs.length, chunks: totalChunks }
  }
}