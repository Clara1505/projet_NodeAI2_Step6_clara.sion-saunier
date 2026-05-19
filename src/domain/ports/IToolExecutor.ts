export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface IToolExecutor {
  execute(name: string, args: Record<string, unknown>): Promise<string>
  getDefinitions(): ToolDefinition[]
}