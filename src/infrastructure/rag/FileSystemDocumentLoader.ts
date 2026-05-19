import { readFile, readdir } from 'node:fs/promises'
import { join, extname } from 'node:path'
import type { IDocumentLoader, DocumentFile } from '../../domain/ports/IDocumentPorts.js'

const DOCS_DIR = join(process.cwd(), 'docs')

export class FileSystemDocumentLoader implements IDocumentLoader {
  async loadAll(): Promise<DocumentFile[]> {
    const files = await readdir(DOCS_DIR, { recursive: true })
    const markdownFiles = files.filter(f => extname(f) === '.md')

    const docs: DocumentFile[] = []
    for (const filename of markdownFiles) {
      const content = await readFile(join(DOCS_DIR, filename), 'utf8')
      docs.push({ filename, content })
    }
    return docs
  }

  async loadOne(filename: string): Promise<string> {
    return readFile(join(DOCS_DIR, filename), 'utf8')
  }
}