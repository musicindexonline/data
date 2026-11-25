import assert from 'node:assert/strict'
import {cp, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  assertManifest,
  calculateCatalogVersion,
  channels,
  normalizeLineEndings,
  recordCount,
  validateSourceCatalog,
  verifyPublishedRelease,
} from '../scripts/lib/catalog.mjs'
import {validateV2Works} from '../scripts/validate-v2-works.mjs'

async function copyPublishedChannel(channelId) {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), `music-index-${channelId}-release-`),
  )
  const channelRoot = path.join(temporaryRoot, channelId)
  await cp(channels[channelId].channelDirectory, channelRoot, {recursive: true})
  return {channelRoot, temporaryRoot}
}

async function readManifest(channelRoot) {
  return JSON.parse(
    await readFile(path.join(channelRoot, 'stable.json'), 'utf8'),
  )
}

async function writeManifest(channelRoot, manifest) {
  await writeFile(
    path.join(channelRoot, 'stable.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
}

test('both current sources validate and have matching stable releases', async () => {
  const v1 = await validateSourceCatalog('v1')
  assert.equal(v1.music.value.length, 977)
  assert.equal(Object.keys(v1.composerMap.value).length, 33)

  const v2 = await validateSourceCatalog('v2')
  assert.ok(Array.isArray(v2.works.value))
  assert.ok(Array.isArray(v2.composer.value))
  assert.ok(v2.works.value.length > 0)
  assert.ok(v2.composer.value.length > 0)

  const validation = await validateV2Works()
  assert.equal(validation.valid, true, validation.errors.join('\n'))

  for (const channelId of Object.keys(channels)) {
    const result = await verifyPublishedRelease(channelId)
    assert.match(result.catalogVersion, /^sha256-[a-f0-9]{16}$/)
  }
})

test('catalog versions are independent of CRLF and LF line endings', () => {
  const lf = Buffer.from('{\n  "composer": "Test"\n}\n')
  const crlf = Buffer.from('{\r\n  "composer": "Test"\r\n}\r\n')
  const catalog = (buffer) => ({
    music: {buffer},
    composerMap: {buffer},
  })

  assert.deepEqual(normalizeLineEndings(crlf), lf)
  assert.equal(
    calculateCatalogVersion(catalog(crlf)),
    calculateCatalogVersion(catalog(lf)),
  )
  assert.equal(recordCount('music', []), 0)
  assert.equal(recordCount('composerMap', {}), 0)
})

test('release verification rejects a modified manifest', async () => {
  const {channelRoot, temporaryRoot} = await copyPublishedChannel('v2')
  try {
    const manifest = await readManifest(channelRoot)
    manifest.files.works.count += 1
    await writeManifest(channelRoot, manifest)

    await assert.rejects(
      verifyPublishedRelease('v2', {channelRoot}),
      /stale or modified/,
    )
  } finally {
    await rm(temporaryRoot, {recursive: true, force: true})
  }
})

test('release verification rejects a missing published file', async () => {
  const {channelRoot, temporaryRoot} = await copyPublishedChannel('v2')
  try {
    const manifest = await readManifest(channelRoot)
    await rm(path.join(channelRoot, manifest.files.works.path))

    await assert.rejects(
      verifyPublishedRelease('v2', {channelRoot}),
      (error) => error.code === 'ENOENT',
    )
  } finally {
    await rm(temporaryRoot, {recursive: true, force: true})
  }
})

test('release verification rejects a file with the wrong hash', async () => {
  const {channelRoot, temporaryRoot} = await copyPublishedChannel('v2')
  try {
    const manifest = await readManifest(channelRoot)
    const worksPath = path.join(channelRoot, manifest.files.works.path)
    const works = await readFile(worksPath)
    await writeFile(worksPath, Buffer.concat([works, Buffer.from('\n')]))

    await assert.rejects(
      verifyPublishedRelease('v2', {channelRoot}),
      /does not match its manifest hash/,
    )
  } finally {
    await rm(temporaryRoot, {recursive: true, force: true})
  }
})

test('release verification rejects a modified record count', async () => {
  const {channelRoot, temporaryRoot} = await copyPublishedChannel('v2')
  try {
    const manifest = await readManifest(channelRoot)
    manifest.files.composer.count -= 1
    await writeManifest(channelRoot, manifest)

    await assert.rejects(
      verifyPublishedRelease('v2', {channelRoot}),
      /stale or modified/,
    )
  } finally {
    await rm(temporaryRoot, {recursive: true, force: true})
  }
})

test('manifest validation rejects paths outside the version directory', async () => {
  const {channelRoot, temporaryRoot} = await copyPublishedChannel('v2')
  try {
    const manifest = await readManifest(channelRoot)
    manifest.files.works.path = '../works.json'
    assert.throws(() => assertManifest(manifest, 'v2'), /Invalid manifest path/)
  } finally {
    await rm(temporaryRoot, {recursive: true, force: true})
  }
})
