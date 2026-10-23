import {access, copyFile, mkdir, readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {
  calculateCatalogVersion,
  catalogFiles,
  channelDirectory,
  createManifest,
  validateSourceCatalog,
} from './lib/catalog.mjs'

const catalog = await validateSourceCatalog()
const catalogVersion = calculateCatalogVersion(catalog)
const versionDirectory = path.join(channelDirectory, 'versions', catalogVersion)

await mkdir(versionDirectory, {recursive: true})

for (const file of Object.values(catalogFiles)) {
  const destination = path.join(versionDirectory, file.filename)
  try {
    await access(destination)
  } catch {
    await copyFile(file.source, destination)
  }
}

const stablePath = path.join(channelDirectory, 'stable.json')
let previousManifest = null
try {
  previousManifest = JSON.parse(await readFile(stablePath, 'utf8'))
} catch {
  // The first release has no previous manifest.
}

const publishedAt =
  previousManifest?.catalogVersion === catalogVersion
    ? previousManifest.publishedAt
    : new Date().toISOString()
const manifest = createManifest(catalog, catalogVersion, publishedAt)

await writeFile(stablePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Released schema v1 catalog ${catalogVersion}`)
