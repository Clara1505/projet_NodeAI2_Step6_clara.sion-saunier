import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import { join, resolve, normalize } from 'node:path'
import type { IToolExecutor, ToolDefinition } from '../../domain/ports/IToolExecutor.js'

const DOCS_DIR = resolve(process.cwd(), 'docs')

const argSchemas = {
  get_weather:     z.object({ city: z.string().min(1) }),
  calculator:      z.object({ expression: z.string().min(1) }),
  get_datetime:    z.object({}).passthrough(),
  read_local_file: z.object({ filename: z.string().min(1) }),
}

async function get_weather({ city }: { city: string }): Promise<string> {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%h+humidité`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`Météo indisponible pour ${city}`)
  return res.text()
}

function calculator({ expression }: { expression: string }): string {
  const safe = /^[\d\s+\-*/().^%,a-z]+$/i
  if (!safe.test(expression)) throw new Error(`Expression non autorisée: ${expression}`)
  const mathFn = new Function('Math', `"use strict"; return (${expression
    .replace(/\^/g, '**')
    .replace(/sqrt/g, 'Math.sqrt')
    .replace(/abs/g, 'Math.abs')
    .replace(/floor/g, 'Math.floor')
    .replace(/ceil/g, 'Math.ceil')
    .replace(/round/g, 'Math.round')
    .replace(/pi/gi, 'Math.PI')
  })`)
  const result = mathFn(Math) as unknown
  if (typeof result !== 'number' || !isFinite(result)) throw new Error('Résultat invalide')
  return String(result)
}

function get_datetime(): string {
  return new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
}

async function read_local_file({ filename }: { filename: string }): Promise<string> {
  const target = normalize(join(DOCS_DIR, filename))
  if (!target.startsWith(DOCS_DIR + '/') && target !== DOCS_DIR) {
    throw new Error(`Accès refusé : ${filename} est en dehors de ./docs`)
  }
  const content = await readFile(target, 'utf8')
  return content.slice(0, 4000)
}

export class ToolExecutorAdapter implements IToolExecutor {
  getDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'get_weather',
        description: 'Retourne la météo actuelle pour une ville.',
        inputSchema: {
          type: 'object',
          required: ['city'],
          properties: { city: { type: 'string', description: 'Nom de la ville (ex: Paris, Lyon)' } }
        }
      },
      {
        name: 'calculator',
        description: 'Évalue une expression mathématique simple.',
        inputSchema: {
          type: 'object',
          required: ['expression'],
          properties: { expression: { type: 'string', description: 'Expression à évaluer' } }
        }
      },
      {
        name: 'get_datetime',
        description: 'Retourne la date et l\'heure actuelle.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'read_local_file',
        description: 'Lit le contenu d\'un fichier dans le dossier ./docs du projet.',
        inputSchema: {
          type: 'object',
          required: ['filename'],
          properties: { filename: { type: 'string', description: 'Nom du fichier dans ./docs' } }
        }
      },
    ]
  }

  async execute(name: string, rawArgs: Record<string, unknown>): Promise<string> {
    const schema = argSchemas[name as keyof typeof argSchemas]
    if (!schema) throw new Error(`Tool inconnu: ${name}`)

    const parsed = schema.safeParse(rawArgs)
    if (!parsed.success) throw new Error(`Arguments invalides pour ${name}: ${parsed.error.message}`)

    switch (name) {
      case 'get_weather':     return get_weather(parsed.data as { city: string })
      case 'calculator':      return calculator(parsed.data as { expression: string })
      case 'get_datetime':    return get_datetime()
      case 'read_local_file': return read_local_file(parsed.data as { filename: string })
      default: throw new Error(`Tool inconnu: ${name}`)
    }
  }
}