import type { Chunk } from '../entities/Chunk.js'

export interface DocumentFile {
  filename: string
  content: string
}

export interface IDocumentLoader {
  loadAll(): Promise<DocumentFile[]>
  loadOne(filename: string): Promise<string>
}

export interface IDocumentChunker {
  chunk(content: string, source: string): Omit<Chunk, 'id'>[]
}