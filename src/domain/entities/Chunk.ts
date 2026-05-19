export interface Chunk {
  id?: number
  source: string
  section: string
  position: number
  content: string
}

export interface ChunkSearchResult {
  source: string
  section: string
  content: string
  similarity: number
}