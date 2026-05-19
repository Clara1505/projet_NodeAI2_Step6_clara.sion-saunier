import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { ToolExecutorAdapter } from '../tools/ToolExecutorAdapter.js'
import { cosineSimilaritySearch } from './StandaloneRetriever.js'

const DOCS_DIR = join(process.cwd(), 'docs')
const tools = new ToolExecutorAdapter()

const MCP_TOOLS = [
  ...tools.getDefinitions().map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema
  })),
  {
    name: 'search_docs',
    description: 'Recherche les passages les plus pertinents dans la documentation Markdown.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Question ou sujet à rechercher' },
        k: { type: 'number', description: 'Nombre de résultats (défaut: 3)', default: 3 }
      }
    }
  }
]

const server = new Server(
  { name: 'mongpt', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: MCP_TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  process.stderr.write(`[MCP] tool_call: ${name} ${JSON.stringify(args)}\n`)

  try {
    let result: string

    if (name === 'search_docs') {
      const { query, k } = args as { query: string; k?: number }
      const results = await cosineSimilaritySearch(query, k ?? 3)
      result = results.length === 0
        ? 'Aucun document pertinent trouvé.'
        : results.map(r => `[${r.source}§${r.section}] (similarité: ${r.similarity})\n${r.content}`).join('\n\n---\n\n')
    } else {
      result = await tools.execute(name, args as Record<string, unknown>)
    }

    process.stderr.write(`[MCP] tool_result: ${result.slice(0, 100)}\n`)
    return { content: [{ type: 'text', text: result }], isError: false }
  } catch (err) {
    process.stderr.write(`[MCP] tool_error: ${(err as Error).message}\n`)
    return { content: [{ type: 'text', text: `Erreur: ${(err as Error).message}` }], isError: true }
  }
})

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const files = await readdir(DOCS_DIR, { recursive: true })
  const resources = files
    .filter((f: string) => extname(f) === '.md')
    .map((f: string) => ({
      uri: `docs://${f}`,
      name: f,
      description: `Document Markdown: ${f}`,
      mimeType: 'text/markdown'
    }))
  return { resources }
})

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const filename = request.params.uri.replace('docs://', '')
  const content = await readFile(join(DOCS_DIR, filename), 'utf8')
  return {
    contents: [{ uri: request.params.uri, mimeType: 'text/markdown', text: content }]
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
process.stderr.write('[MCP] Serveur mongpt démarré — en attente sur stdin\n')