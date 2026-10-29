import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validateV2Works,
  workIdFromWork,
} from '../scripts/validate-v2-works.mjs'

test('current v2 works satisfy Schema and relational rules', async () => {
  const result = await validateV2Works()
  assert.deepEqual(result.errors, [])
  assert.equal(result.valid, true)
})

test('workId omits a catalogue identifier that is not primary', () => {
  assert.equal(
    workIdFromWork({
      composerId: 'gustav-mahler',
      title: {preferred: 'Symphony No. 2 in C Minor'},
      identifiers: [
        {catalog: 'gmw', value: '30', display: 'GMW 30', primary: false},
      ],
    }),
    'gustav-mahler-symphony-no-2-in-c-minor',
  )
})

test('workId is the second field in every current work object', async () => {
  const result = await validateV2Works()
  for (const work of result.works) {
    assert.deepEqual(Object.keys(work).slice(0, 2), ['composerId', 'workId'])
  }
})

test('same preferred title is allowed when workIds differ', async () => {
  const result = await validateV2Works()
  const bwv1060 = result.works.find(
    (work) => work.identifiers?.some(
      (identifier) => identifier.display === 'BWV 1060',
    ),
  )
  const bwv1062 = result.works.find(
    (work) => work.identifiers?.some(
      (identifier) => identifier.display === 'BWV 1062',
    ),
  )

  assert.equal(bwv1060.title.preferred, bwv1062.title.preferred)
  assert.notEqual(bwv1060.workId, bwv1062.workId)
  assert.deepEqual(result.errors, [])
})
