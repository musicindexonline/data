import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import Ajv from 'ajv'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))

export const repositoryRoot = path.resolve(scriptsDir, '..', '..')
export const publicDirectory = path.join(repositoryRoot, 'public')

function createChannel({
  version,
  schemaVersion,
  files,
}) {
  const directoryName = `v${version}`
  const sourceDirectory = path.join(repositoryRoot, 'source', directoryName)
  const schemaDirectory = path.join(repositoryRoot, 'schemas', directoryName)
  const channelDirectory = path.join(publicDirectory, directoryName)
  const catalogFiles = {}

  for (const [key, file] of Object.entries(files)) {
    catalogFiles[key] = {
      source: path.join(sourceDirectory, file.source),
      schema: path.join(schemaDirectory, file.schema),
      filename: file.filename,
      count: file.count,
    }
  }

  return Object.freeze({
    id: directoryName,
    version,
    schemaVersion,
    sourceDirectory,
    schemaDirectory,
    channelDirectory,
    catalogFiles: Object.freeze(catalogFiles),
  })
}

export const channels = Object.freeze({
  v1: createChannel({
    version: 1,
    schemaVersion: '1.0.0',
    files: {
      music: {
        source: 'music.json',
        schema: 'music.schema.json',
        filename: 'music.json',
        count: 'array',
      },
      composerMap: {
        source: 'composerMap.json',
        schema: 'composerMap.schema.json',
        filename: 'composerMap.json',
        count: 'object',
      },
    },
  }),
  v2: createChannel({
    version: 2,
    schemaVersion: '2.0.0',
    files: {
      works: {
        source: 'works.json',
        schema: 'works.schema.json',
        filename: 'works.json',
        count: 'array',
      },
      composer: {
        source: 'composer.json',
        schema: 'composer.schema.json',
        filename: 'composer.json',
        count: 'array',
      },
    },
  }),
})

// Keep the original v1 exports for callers that only operate on the legacy channel.
export const schemaVersion = channels.v1.schemaVersion
export const sourceDirectory = channels.v1.sourceDirectory
export const schemaDirectory = channels.v1.schemaDirectory
export const channelDirectory = channels.v1.channelDirectory
export const catalogFiles = channels.v1.catalogFiles

export function getChannel(channelId = 'v1') {
  const channel = channels[channelId]
  if (!channel) {
    throw new Error(`Unknown catalog channel: ${channelId}`)
  }
  return channel
}

export async function readSourceCatalog(channelId = 'v1') {
  const channel = getChannel(channelId)
  const entries = await Promise.all(
    Object.entries(channel.catalogFiles).map(async ([key, file]) => {
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

export async function validateSourceCatalog(channelId = 'v1') {
  const channel = getChannel(channelId)
  const ajv = new Ajv({allErrors: true, strict: true})
  const catalog = await readSourceCatalog(channelId)

  for (const [key, file] of Object.entries(channel.catalogFiles)) {
    const schema = JSON.parse(await readFile(file.schema, 'utf8'))
    const validate = ajv.compile(schema)
    if (!validate(catalog[key].value)) {
      throw new Error(
        `${channelId}/${file.filename} does not match its JSON Schema: ${ajv.errorsText(validate.errors)}`,
      )
    }
  }

  if (channelId === 'v1') {
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
  }

  return catalog
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

export function calculateCatalogVersion(catalog, channelId = 'v1') {
  const channel = getChannel(channelId)
  const combined = createHash('sha256')
  for (const key of Object.keys(channel.catalogFiles)) {
    const buffer = normalizeLineEndings(catalog[key].buffer)
    combined.update(`${key}\0${buffer.length}\0`)
    combined.update(buffer)
  }
  return `sha256-${combined.digest('hex').slice(0, 16)}`
}

export function recordCount(key, value, channelId = 'v1') {
  const channel = getChannel(channelId)
  const file = channel.catalogFiles[key]
  if (!file) {
    throw new Error(`Unknown catalog file for ${channelId}: ${key}`)
  }
  return file.count === 'array'
    ? Array.isArray(value) ? value.length : -1
    : value && typeof value === 'object' && !Array.isArray(value)
      ? Object.keys(value).length
      : -1
}

export function createManifest(
  catalog,
  catalogVersion,
  publishedAt = new Date().toISOString(),
  channelId = 'v1',
) {
  const channel = getChannel(channelId)
  const files = {}
  for (const [key, file] of Object.entries(channel.catalogFiles)) {
    const value = catalog[key].value
    const buffer = normalizeLineEndings(catalog[key].buffer)
    files[key] = {
      path: `versions/${catalogVersion}/${file.filename}`,
      sha256: sha256(buffer),
      count: recordCount(key, value, channelId),
    }
  }

  return {
    schemaVersion: channel.schemaVersion,
    catalogVersion,
    publishedAt,
    files,
  }
}

export function assertSafeRelativePath(filePath) {
  if (
    typeof filePath !== 'string'
    || !filePath
    || filePath.startsWith('/')
    || filePath.includes('\\')
    || filePath.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error(`Invalid manifest path: ${filePath}`)
  }
}

export function assertManifest(manifest, channelId) {
  const channel = getChannel(channelId)
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(`Catalog ${channelId} manifest must be an object`)
  }
  if (manifest.schemaVersion !== channel.schemaVersion) {
    throw new Error(
      `Catalog ${channelId} manifest has schema ${manifest.schemaVersion}`,
    )
  }
  if (typeof manifest.catalogVersion !== 'string' || !manifest.catalogVersion) {
    throw new Error(`Catalog ${channelId} manifest has no catalogVersion`)
  }
  if (
    typeof manifest.publishedAt !== 'string'
    || Number.isNaN(Date.parse(manifest.publishedAt))
  ) {
    throw new Error(`Catalog ${channelId} manifest has an invalid publishedAt`)
  }
  if (!manifest.files || typeof manifest.files !== 'object') {
    throw new Error(`Catalog ${channelId} manifest has no files`)
  }

  const expectedKeys = Object.keys(channel.catalogFiles)
  const actualKeys = Object.keys(manifest.files)
  if (
    expectedKeys.length !== actualKeys.length
    || expectedKeys.some((key) => !Object.hasOwn(manifest.files, key))
  ) {
    throw new Error(`Catalog ${channelId} manifest has unexpected files`)
  }

  for (const [key, expectedFile] of Object.entries(channel.catalogFiles)) {
    const file = manifest.files[key]
    if (!file || typeof file !== 'object') {
      throw new Error(`Catalog ${channelId} manifest has no ${key} file`)
    }
    assertSafeRelativePath(file.path)
    const expectedPath = `versions/${manifest.catalogVersion}/${expectedFile.filename}`
    if (file.path !== expectedPath) {
      throw new Error(
        `Catalog ${channelId} ${key} path must be ${expectedPath}`,
      )
    }
    if (typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(file.sha256)) {
      throw new Error(`Catalog ${channelId} ${key} has an invalid SHA-256`)
    }
    if (!Number.isInteger(file.count) || file.count < 0) {
      throw new Error(`Catalog ${channelId} ${key} has an invalid record count`)
    }
  }
}

export function assertManifestMatches(manifest, expectedManifest, channelId) {
  assertManifest(manifest, channelId)
  if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest)) {
    throw new Error(
      `${channelId}/stable.json is stale or modified; run npm run release and commit the result`,
    )
  }
}

export async function verifyPublishedRelease(
  channelId,
  {channelRoot = getChannel(channelId).channelDirectory} = {},
) {
  const channel = getChannel(channelId)
  const catalog = await validateSourceCatalog(channelId)
  const expectedVersion = calculateCatalogVersion(catalog, channelId)
  const stablePath = path.join(channelRoot, 'stable.json')
  const manifest = JSON.parse(await readFile(stablePath, 'utf8'))
  const expectedManifest = createManifest(
    catalog,
    expectedVersion,
    manifest.publishedAt,
    channelId,
  )
  assertManifestMatches(manifest, expectedManifest, channelId)

  for (const [key, file] of Object.entries(expectedManifest.files)) {
    const releasePath = path.join(channelRoot, file.path)
    const buffer = await readFile(releasePath)
    const sourceBuffer = normalizeLineEndings(
      await readFile(channel.catalogFiles[key].source),
    )
    if (sha256(buffer) !== file.sha256) {
      throw new Error(`${channelId}/${file.path} does not match its manifest hash`)
    }
    if (!buffer.equals(sourceBuffer)) {
      throw new Error(`${channelId}/${file.path} does not match its source file`)
    }

    const value = JSON.parse(buffer.toString('utf8'))
    if (recordCount(key, value, channelId) !== file.count) {
      throw new Error(`${channelId}/${file.path} has an unexpected record count`)
    }
  }

  return {channel, manifest, catalogVersion: expectedVersion}
}
