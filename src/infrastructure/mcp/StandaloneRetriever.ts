import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { MarkdownChunker } from '../../domain/services/MarkdownChunker.js'
import { OllamaGateway } from '../llm/OllamaGateway.js'

const DOCS_DIR = join(process.cwd(), 'docs')
const MIN_SIMILARITY = 0.65

const OLLAMA_URL  = process.env.OLLAMA_URL   ?? 'http://localhost:11434'
const MODEL       = process.env.OLLAMA_MODEL ?? 'llama3.2'
const EMBED_MODEL = process.env.EMBED_MODEL  ?? 'nomic-embed-text'

const llm = new OllamaGateway(OLLAMA_URL, MODEL, EMBED_MODEL)
const chunker = new MarkdownChunker()

interface CachedChunk {
  source: string
  section: string
  content: string
  embedding: number[]
}

let chunksCache: CachedChunk[] | null = null

async function loadChunks(): Promise<CachedChunk[]> {
  if (chunksCache) return chunksCache

  const files = await readdir(DOCS_DIR, { recursive: true })
  const markdownFiles = files.filter((f: string) => extname(f) === '.md')

  const allChunks: CachedChunk[] = []
  for (const file of markdownFiles) {
    const content = await readFile(join(DOCS_DIR, file), 'utf8')
    const chunks = chunker.chunk(content, file)
    for (const chunk of chunks) {
      const embedding = await llm.embed(chunk.content)
      allChunks.push({ source: chunk.source, section: chunk.section, content: chunk.content, embedding })
    }
  }

  chunksCache = allChunks
  return allChunks
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export async function cosineSimilaritySearch(
  query: string,
  k = 3
): Promise<Array<{ source: string; section: string; content: string; similarity: number }>> {
  const queryEmbedding = await llm.embed(query)
  const chunks = await loadChunks()

  return chunks
    .map(c => ({
      source: c.source,
      section: c.section,
      content: c.content,
      similarity: Math.round(cosineSimilarity(queryEmbedding, c.embedding) * 1000) / 1000
    }))
    .filter(c => c.similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
}