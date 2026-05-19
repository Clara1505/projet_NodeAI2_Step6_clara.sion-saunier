import type { StreamEvent } from '../entities/StreamEvent.js'

export interface LlmMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: LlmToolCall[]
}

export interface LlmToolCall {
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

export interface ILlmGateway {
  chat(messages: LlmMessage[]): Promise<string>
  chatStream(
    messages: LlmMessage[],
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void>
  chatWithToolsStream(
    messages: LlmMessage[],
    tools: unknown[],
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<{ assistantContent: string; toolCalls: LlmToolCall[] }>
  embed(text: string): Promise<number[]>
}