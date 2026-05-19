export type StreamEvent =
  | { type: 'token'; value: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'sources'; sources: Array<{ source: string; section: string; similarity: number }> }