import assert from 'node:assert/strict'
import test from 'node:test'
import {validateV2Works} from '../scripts/validate-v2-works.mjs'

test('current v2 works satisfy Schema and relational rules', async () => {
  const result = await validateV2Works()
  assert.deepEqual(result.errors, [])
  assert.equal(result.valid, true)
})
