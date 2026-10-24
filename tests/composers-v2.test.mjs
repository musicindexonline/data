import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import Ajv from 'ajv'
import {repositoryRoot} from '../scripts/lib/catalog.mjs'

test('v2 composer data preserves order, metadata, and Schema', async () => {
  const sourceV1 = path.join(repositoryRoot, 'source', 'v1')
  const composerMap = JSON.parse(
    await readFile(path.join(sourceV1, 'composerMap.json'), 'utf8'),
  )
  const works = JSON.parse(
    await readFile(path.join(sourceV1, 'music.json'), 'utf8'),
  )
  const composers = JSON.parse(
    await readFile(
      path.join(repositoryRoot, 'source', 'v2', 'composer.json'),
      'utf8',
    ),
  )
  const schema = JSON.parse(
    await readFile(
      path.join(repositoryRoot, 'schemas', 'v2', 'composer.schema.json'),
      'utf8',
    ),
  )

  assert.equal(composers.length, 33)
  assert.equal(new Set(composers.map((composer) => composer.id)).size, 33)
  assert.deepEqual(
    composers.map((composer) => composer.name),
    Object.keys(composerMap),
  )

  for (const composer of composers) {
    assert.equal(composer.shortName, composerMap[composer.name])
    const periods = [
      ...new Set(
        works
          .filter((work) => work.composer === composer.name)
          .map((work) => work.period),
      ),
    ]
    assert.equal(periods.length, 1)
    assert.equal(composer.defaultPeriod, periods[0])
  }

  const composersByName = new Map(
    composers.map((composer) => [composer.name, composer]),
  )
  assert.equal(composersByName.get('Gustav Mahler').id, 'gustav-mahler')
  assert.equal(
    composersByName.get('Georg Friedrich Händel').id,
    'georg-friedrich-handel',
  )
  assert.equal(
    composersByName.get('François-Adrien Boieldieu').id,
    'francois-adrien-boieldieu',
  )

  const ajv = new Ajv({allErrors: true, strict: true})
  const validate = ajv.compile(schema)
  assert.equal(validate(composers), true, ajv.errorsText(validate.errors))
  assert.equal(
    validate([{id: 'composer-without-period', name: 'Composer', shortName: 'Composer'}]),
    true,
    ajv.errorsText(validate.errors),
  )
})
