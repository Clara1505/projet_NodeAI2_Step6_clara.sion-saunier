import type { ILlmGateway, LlmMessage } from '../../domain/ports/ILlmGateway.js'
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js'
import type { StreamEvent } from '../../domain/entities/StreamEvent.js'

const MAX_ITERATIONS = 5

export class AgentUseCase {
  constructor(
    private readonly llm: ILlmGateway,
    private readonly tools: IToolExecutor
  ) {}

  async run(
    message: string,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const messages: LlmMessage[] = [{ role: 'user', content: message }]
    const toolDefs = this.tools.getDefinitions()

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const { assistantContent, toolCalls } = await this.llm.chatWithToolsStream(
        messages, toolDefs, onEvent, signal
      )

      messages.push({
        role: 'assistant',
        content: assistantContent,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {})
      })

      if (!toolCalls.length) {
        onEvent({ type: 'done' })
        break
      }

      for (const tc of toolCalls) {
        const name = tc.function.name
        const args = tc.function.arguments
        onEvent({ type: 'tool_call', name, args })

        let result: string
        try {
          result = await this.tools.execute(name, args)
        } catch (err) {
          result = `Erreur: ${(err as Error).message}`
        }

        onEvent({ type: 'tool_result', name, result })
        messages.push({ role: 'tool', content: result })
      }
    }
  }
}