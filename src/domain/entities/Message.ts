export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface Message {
  id: number
  conversationId: number
  role: MessageRole
  content: string
  createdAt: string
}