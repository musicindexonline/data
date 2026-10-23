import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import Ajv from 'ajv'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))

export const repositoryRoot = path.resolve(scriptsDir, '..', '..')
export const schemaVersion = '1.0.0'
export const sourceDirectory = path.join(repositoryRoot, 'source', 'v1')
export const schemaDirectory = path.join(repositoryRoot, 'schemas', 'v1')
export const publicDirectory = path.join(repositoryRoot, 'public')
export const channelDirectory = path.join(publicDirectory, 'v1')

export const catalogFiles = {
  music: {
    source: path.join(sourceDirectory, 'music.json'),
    schema: path.join(schemaDirectory, 'music.schema.json'),
    filename: 'music.json',
  },
  composerMap: {
    source: path.join(sourceDirectory, 'composerMap.json'),
    schema: path.join(schemaDirectory, 'composerMap.schema.json'),
    filename: 'composerMap.json',
  },
}

export async function readSourceCatalog() {
  const entries = await Promise.all(
    Object.entries(catalogFiles).map(async ([key, file]) => {
      const buffer = normalizeLineEndings(await readFile(file.source))
      return [key, {buffer, value: JSON.parse(buffer.toString('utf8'))}]
    }),
  )

  return Object.fromEntries(entries)
}

export function normalizeLineEndings(buffer) {
  return Buffer.from(
    buffer.toString('utf8').replace(/\r\n?/g, '\n'),
    'utf8',
  )
}

export async function validateSourceCatalog() {
  const ajv = new Ajv({allErrors: true, strict: true})
  const catalog = await readSourceCatalog()

  for (const [key, file] of Object.entries(catalogFiles)) {
    const schema = JSON.parse(await readFile(file.schema, 'utf8'))
    const validate = ajv.compile(schema)
    if (!validate(catalog[key].value)) {
      throw new Error(
        `${file.filename} does not match its JSON Schema: ${ajv.errorsText(validate.errors)}`,
      )
    }
  }

  const works = catalog.music.value
  const composerMap = catalog.composerMap.value
  const missingComposers = [
    ...new Set(
      works
        .map((work) => work.composer)
        .filter((composer) => !Object.hasOwn(composerMap, composer)),
    ),
  ]

  if (missingComposers.length > 0) {
    throw new Error(`composerMap is missing: ${missingComposers.join(', ')}`)
  }

  return catalog
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

export function calculateCatalogVersion(catalog) {
  const combined = createHash('sha256')
  for (const key of ['music', 'composerMap']) {
    const buffer = normalizeLineEndings(catalog[key].buffer)
    combined.update(`${key}\0${buffer.length}\0`)
    combined.update(buffer)
  }
  return `sha256-${combined.digest('hex').slice(0, 16)}`
}

export function recordCount(key, value) {
  return key === 'music' ? value.length : Object.keys(value).length
}

export function createManifest(catalog, catalogVersion, publishedAt = new Date().toISOString()) {
  const files = {}
  for (const [key, file] of Object.entries(catalogFiles)) {
    const value = catalog[key].value
    const buffer = normalizeLineEndings(catalog[key].buffer)
    files[key] = {
      path: `versions/${catalogVersion}/${file.filename}`,
      sha256: sha256(buffer),
      count: recordCount(key, value),
    }
  }

  return {
    schemaVersion,
    catalogVersion,
    publishedAt,
    files,
  }
}
