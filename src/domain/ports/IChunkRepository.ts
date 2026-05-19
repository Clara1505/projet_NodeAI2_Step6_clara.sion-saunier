export interface ChunkRow {
  id: number
  source: string
  section: string
  position: number
  content: string
  embedding: string // vecteur sérialisé en JSON
}

export interface IChunkRepository {
  insert(source: string, section: string, position: number, content: string, embedding: number[]): void
  findAll(): ChunkRow[]
  count(): number
  deleteAll(): void
}