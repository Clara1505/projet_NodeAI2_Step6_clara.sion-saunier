import type Database from 'better-sqlite3'
import type { IConversationRepository } from '../../domain/ports/IConversationRepository.js'
import type { Conversation } from '../../domain/entities/Conversation.js'

export class SqliteConversationRepository implements IConversationRepository {
  private readonly stmts

  constructor(private readonly db: Database.Database) {
    this.stmts = {
      create:      db.prepare<[string], Conversation>('INSERT INTO conversations (title) VALUES (?) RETURNING *'),
      findAll:     db.prepare<[], Conversation>(`
        SELECT c.id, c.title, c.createdAt, COUNT(m.id) AS messageCount
        FROM conversations c
        LEFT JOIN messages m ON m.conversationId = c.id
        GROUP BY c.id ORDER BY c.createdAt DESC
      `),
      findById:    db.prepare<[number], Conversation>('SELECT * FROM conversations WHERE id = ?'),
      delete:      db.prepare<[number]>('DELETE FROM conversations WHERE id = ?'),
      updateTitle: db.prepare<[string, number]>('UPDATE conversations SET title = ? WHERE id = ?'),
    }
  }

  create(title: string): Conversation {
    return this.stmts.create.get(title) as Conversation
  }

  findAll(): Conversation[] {
    return this.stmts.findAll.all() as Conversation[]
  }

  findById(id: number): Conversation | undefined {
    return this.stmts.findById.get(id) as Conversation | undefined
  }

  delete(id: number): boolean {
    const result = this.stmts.delete.run(id)
    return result.changes > 0
  }

  updateTitle(id: number, title: string): void {
    this.stmts.updateTitle.run(title, id)
  }
}