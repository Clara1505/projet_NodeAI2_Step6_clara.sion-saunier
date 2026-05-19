import type { ILlmGateway, LlmMessage, LlmToolCall } from '../../domain/ports/ILlmGateway.js'
import type { StreamEvent } from '../../domain/entities/StreamEvent.js'

export class OllamaGateway implements ILlmGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly embedModel: string
  ) {}

  async chat(messages: LlmMessage[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: false })
    })
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { message: { content: string } }
    return data.message.content
  }

  async chatStream(
    messages: LlmMessage[],
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ model: this.model, messages, stream: true })
    })
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`)

    for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
      const lines = Buffer.from(chunk).toString('utf8').split('\n').filter(Boolean)
      for (const line of lines) {
        const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
        if (parsed.message?.content) onEvent({ type: 'token', value: parsed.message.content })
        if (parsed.done) onEvent({ type: 'done' })
      }
    }
  }

  async chatWithToolsStream(
    messages: LlmMessage[],
    tools: unknown[],
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<{ assistantContent: string; toolCalls: LlmToolCall[] }> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ model: this.model, messages, tools, stream: true })
    })
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`)

    let assistantContent = ''
    const toolCalls: LlmToolCall[] = []

    for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
      const lines = Buffer.from(chunk).toString('utf8').split('\n').filter(Boolean)
      for (const line of lines) {
        const parsed = JSON.parse(line) as {
          message?: { content?: string; tool_calls?: LlmToolCall[] }
          done?: boolean
        }
        if (parsed.message?.content) {
          assistantContent += parsed.message.content
          onEvent({ type: 'token', value: parsed.message.content })
        }
        if (parsed.message?.tool_calls?.length) {
          toolCalls.push(...parsed.message.tool_calls)
        }
      }
    }

    return { assistantContent, toolCalls }
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.embedModel, prompt: text })
    })
    if (!res.ok) throw new Error(`Ollama embeddings error: ${res.status}`)
    const data = await res.json() as { embedding: number[] }
    return data.embedding
  }
}