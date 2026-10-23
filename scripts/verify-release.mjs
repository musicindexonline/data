import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {
  calculateCatalogVersion,
  channelDirectory,
  createManifest,
  recordCount,
  sha256,
  validateSourceCatalog,
} from './lib/catalog.mjs'

const catalog = await validateSourceCatalog()
const expectedVersion = calculateCatalogVersion(catalog)
const stablePath = path.join(channelDirectory, 'stable.json')
const manifest = JSON.parse(await readFile(stablePath, 'utf8'))
const expectedManifest = createManifest(catalog, expectedVersion, manifest.publishedAt)

if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest)) {
  throw new Error('stable.json is stale; run npm run release and commit the result')
}

for (const [key, file] of Object.entries(expectedManifest.files)) {
  const releasePath = path.join(channelDirectory, file.path)
  const buffer = await readFile(releasePath)
  if (sha256(buffer) !== file.sha256) {
    throw new Error(`${file.path} does not match the hash in stable.json`)
  }

  const value = JSON.parse(buffer.toString('utf8'))
  if (recordCount(key, value) !== file.count) {
    throw new Error(`${file.path} has an unexpected record count`)
  }
}

console.log(`Verified schema v1 catalog ${expectedVersion}`)
