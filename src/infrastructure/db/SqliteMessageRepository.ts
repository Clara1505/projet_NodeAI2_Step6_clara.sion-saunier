import type Database from 'better-sqlite3'
import type { IMessageRepository } from '../../domain/ports/IMessageRepository.js'
import type { Message, MessageRole } from '../../domain/entities/Message.js'

export class SqliteMessageRepository implements IMessageRepository {
  private readonly stmts

  constructor(db: Database.Database) {
    this.stmts = {
      findByConvId: db.prepare<[number], Message>('SELECT * FROM messages WHERE conversationId = ? ORDER BY id'),
      add:          db.prepare<[number, string, string], Message>(
        'INSERT INTO messages (conversationId, role, content) VALUES (?, ?, ?) RETURNING *'
      ),
    }
  }

  findByConversationId(conversationId: number): Message[] {
    return this.stmts.findByConvId.all(conversationId) as Message[]
  }

  add(conversationId: number, role: MessageRole, content: string): Message {
    return this.stmts.add.get(conversationId, role, content) as Message
  }
}