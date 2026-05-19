import matter from 'gray-matter'
import type { IDocumentChunker } from '../ports/IDocumentPorts.js'
import type { Chunk } from '../entities/Chunk.js'

const CHUNK_SIZE = 500
const OVERLAP = 50

export class MarkdownChunker implements IDocumentChunker {
  chunk(content: string, source: string): Omit<Chunk, 'id'>[] {
    const { data: frontmatter, content: body } = matter(content)
    const title = (frontmatter.title as string | undefined) ?? source

    const paragraphs = body.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean)

    const chunks: Omit<Chunk, 'id'>[] = []
    let currentChunk = ''
    let currentSection = title
    let position = 0

    const flush = () => {
      if (currentChunk.trim()) {
        chunks.push({ source, section: currentSection, position: position++, content: currentChunk.trim() })
      }
    }

    for (const paragraph of paragraphs) {
      const headingMatch = paragraph.match(/^#{1,3}\s+(.+)/)
      if (headingMatch) currentSection = headingMatch[1]

      const approxTokens = (currentChunk + paragraph).length / 4

      if (approxTokens > CHUNK_SIZE && currentChunk) {
        flush()
        currentChunk = currentChunk.slice(-(OVERLAP * 4)) + '\n\n' + paragraph
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph
      }
    }

    flush()
    return chunks
  }
}