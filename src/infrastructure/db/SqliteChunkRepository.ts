import type Database from 'better-sqlite3'
import type { IChunkRepository, ChunkRow } from '../../domain/ports/IChunkRepository.js'

export class SqliteChunkRepository implements IChunkRepository {
  private readonly stmts

  constructor(db: Database.Database) {
    this.stmts = {
      insert:     db.prepare<[string, string, number, string, string]>(
        'INSERT INTO chunks (source, section, position, content, embedding) VALUES (?, ?, ?, ?, ?)'
      ),
      findAll:    db.prepare<[], ChunkRow>('SELECT id, source, section, position, content, embedding FROM chunks'),
      count:      db.prepare<[], { count: number }>('SELECT COUNT(*) as count FROM chunks'),
      deleteAll:  db.prepare('DELETE FROM chunks'),
    }
  }

  insert(source: string, section: string, position: number, content: string, embedding: number[]): void {
    this.stmts.insert.run(source, section, position, content, JSON.stringify(embedding))
  }

  findAll(): ChunkRow[] {
    return this.stmts.findAll.all() as ChunkRow[]
  }

  count(): number {
    return (this.stmts.count.get() as { count: number }).count
  }

  deleteAll(): void {
    this.stmts.deleteAll.run()
  }
}