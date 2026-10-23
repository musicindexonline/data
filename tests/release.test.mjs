import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import {
  calculateCatalogVersion,
  channelDirectory,
  createManifest,
  normalizeLineEndings,
  validateSourceCatalog,
} from '../scripts/lib/catalog.mjs'

test('current source matches Schema v1 and has a stable release', async () => {
  const catalog = await validateSourceCatalog()
  assert.equal(catalog.music.value.length, 977)
  assert.equal(Object.keys(catalog.composerMap.value).length, 33)

  const catalogVersion = calculateCatalogVersion(catalog)
  const stable = JSON.parse(
    await readFile(path.join(channelDirectory, 'stable.json'), 'utf8'),
  )
  const expected = createManifest(catalog, catalogVersion, stable.publishedAt)
  assert.deepEqual(stable, expected)
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
})
