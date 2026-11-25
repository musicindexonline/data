import {mkdir, readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {
  calculateCatalogVersion,
  channels,
  createManifest,
  validateSourceCatalog,
} from './lib/catalog.mjs'
import {validateV2Works} from './validate-v2-works.mjs'

async function validateChannelSource(channelId) {
  const catalog = await validateSourceCatalog(channelId)
  if (channelId === 'v2') {
    const result = await validateV2Works()
    if (!result.valid) {
      throw new Error(`Schema v2 validation failed:\n${result.errors.join('\n')}`)
    }
  }
  return catalog
}

async function writeImmutableFile(destination, buffer) {
  try {
    const existing = await readFile(destination)
    if (!existing.equals(buffer)) {
      throw new Error(
        `Refusing to overwrite immutable release file: ${destination}`,
      )
    }
    return
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await writeFile(destination, buffer)
}

async function releaseChannel(channelId) {
  const channel = channels[channelId]
  const catalog = await validateChannelSource(channelId)
  const catalogVersion = calculateCatalogVersion(catalog, channelId)
  const versionDirectory = path.join(
    channel.channelDirectory,
    'versions',
    catalogVersion,
  )

  await mkdir(versionDirectory, {recursive: true})

  for (const [key, file] of Object.entries(channel.catalogFiles)) {
    await writeImmutableFile(
      path.join(versionDirectory, file.filename),
      catalog[key].buffer,
    )
  }

  const stablePath = path.join(channel.channelDirectory, 'stable.json')
  let previousManifest = null
  try {
    previousManifest = JSON.parse(await readFile(stablePath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  const publishedAt =
    previousManifest?.catalogVersion === catalogVersion
      ? previousManifest.publishedAt
      : new Date().toISOString()
  const manifest = createManifest(
    catalog,
    catalogVersion,
    publishedAt,
    channelId,
  )

  await writeFile(stablePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`Released Schema ${channel.version} catalog ${catalogVersion}`)
}

for (const channelId of Object.keys(channels)) {
  await releaseChannel(channelId)
}
