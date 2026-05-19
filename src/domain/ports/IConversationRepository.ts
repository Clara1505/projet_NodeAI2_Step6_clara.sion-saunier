import type { Conversation } from '../entities/Conversation.js'

export interface IConversationRepository {
  create(title: string): Conversation
  findAll(): Conversation[]
  findById(id: number): Conversation | undefined
  delete(id: number): boolean
  updateTitle(id: number, title: string): void
}