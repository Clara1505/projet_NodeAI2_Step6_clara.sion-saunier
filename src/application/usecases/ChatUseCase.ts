import type { ILlmGateway } from '../../domain/ports/ILlmGateway.js'
import type { StreamEvent } from '../../domain/entities/StreamEvent.js'

export class ChatUseCase {
  constructor(private readonly llm: ILlmGateway) {}

  async chat(message: string): Promise<string> {
    return this.llm.chat([{ role: 'user', content: message }])
  }

  async chatStream(
    message: string,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    return this.llm.chatStream([{ role: 'user', content: message }], onEvent, signal)
  }
}