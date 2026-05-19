import type { Message, MessageRole } from '../entities/Message.js'

export interface IMessageRepository {
  findByConversationId(conversationId: number): Message[]
  add(conversationId: number, role: MessageRole, content: string): Message
}