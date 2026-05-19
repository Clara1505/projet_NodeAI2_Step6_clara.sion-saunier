import type { IConversationRepository } from '../../domain/ports/IConversationRepository.js'
import type { IMessageRepository } from '../../domain/ports/IMessageRepository.js'
import type { ILlmGateway } from '../../domain/ports/ILlmGateway.js'
import type { Conversation } from '../../domain/entities/Conversation.js'
import type { Message } from '../../domain/entities/Message.js'
import type { StreamEvent } from '../../domain/entities/StreamEvent.js'

export class ConversationUseCase {
  constructor(
    private readonly convRepo: IConversationRepository,
    private readonly msgRepo: IMessageRepository,
    private readonly llm: ILlmGateway
  ) {}

  create(): Conversation {
    return this.convRepo.create('Nouvelle conversation')
  }

  findAll(): Conversation[] {
    return this.convRepo.findAll()
  }

  findById(id: number): (Conversation & { messages: Message[] }) | null {
    const conv = this.convRepo.findById(id)
    if (!conv) return null
    return { ...conv, messages: this.msgRepo.findByConversationId(id) }
  }

  delete(id: number): boolean {
    return this.convRepo.delete(id)
  }

  async sendMessage(
    convId: number,
    message: string,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const history = this.msgRepo.findByConversationId(convId)
    if (history.length === 0) {
      this.convRepo.updateTitle(convId, message.slice(0, 60))
    }

    this.msgRepo.add(convId, 'user', message)

    const updatedHistory = this.msgRepo.findByConversationId(convId)
    const llmMessages = updatedHistory.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content
    }))

    let fullResponse = ''
    await this.llm.chatStream(llmMessages, (event) => {
      if (event.type === 'token') fullResponse += event.value
      if (event.type === 'done') this.msgRepo.add(convId, 'assistant', fullResponse)
      onEvent(event)
    }, signal)
  }
}