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
