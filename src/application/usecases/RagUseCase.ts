import type { ILlmGateway } from '../../domain/ports/ILlmGateway.js'
import type { IChunkRepository } from '../../domain/ports/IChunkRepository.js'
import type { ChunkSearchResult } from '../../domain/entities/Chunk.js'
import type { StreamEvent } from '../../domain/entities/StreamEvent.js'

const MIN_SIMILARITY = 0.65
const RAG_SYSTEM_PROMPT = `Tu es un assistant qui répond UNIQUEMENT à partir du contexte ci-dessous.
Si le contexte ne contient pas la réponse, réponds exactement : "Je ne trouve pas l'information dans mes documents."
Cite tes sources entre crochets, format [fichier.md§section].`

export class RagUseCase {
  constructor(
    private readonly llm: ILlmGateway,
    private readonly chunkRepo: IChunkRepository
  ) {}

  async search(query: string, k = 4): Promise<ChunkSearchResult[]> {
    const queryEmbedding = await this.llm.embed(query)
    const chunks = this.chunkRepo.findAll()

    return chunks
      .map(chunk => {
        const embedding = JSON.parse(chunk.embedding) as number[]
        return {
          source: chunk.source,
          section: chunk.section,
          content: chunk.content,
          similarity: this.cosineSim(queryEmbedding, embedding)
        }
      })
      .filter(c => c.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k)
  }

  async chatStream(
    message: string,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const chunks = await this.search(message)

    if (chunks.length === 0) {
      onEvent({ type: 'token', value: "Je ne trouve pas l'information dans mes documents." })
      onEvent({ type: 'done' })
      return
    }

    onEvent({
      type: 'sources',
      sources: chunks.map(c => ({
        source: c.source,
        section: c.section,
        similarity: Math.round(c.similarity * 1000) / 1000
      }))
    })

    const contextBlock = chunks
      .map(c => `[${c.source}§${c.section}]\n${c.content}`)
      .join('\n\n---\n\n')

    await this.llm.chatStream([
      { role: 'system', content: `${RAG_SYSTEM_PROMPT}\n\nContexte :\n${contextBlock}` },
      { role: 'user', content: message }
    ], onEvent, signal)
  }

  private cosineSim(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}