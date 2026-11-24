import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeMediums,
  orderWorkUnionFields,
  removeEmptyOptionalArrays,
} from '../scripts/lib/works-transforms.mjs'

test('normalizes medium values at work and movement levels', () => {
  const result = normalizeMediums([{
    medium: ['Bass_Clarinet', 'English Horn', 'PIANO'],
    movements: [{
      medium: ['Bass_Drum'],
    }],
  }])

  assert.deepEqual(result.works[0].medium, [
    'bass clarinet',
    'english horn',
    'piano',
  ])
  assert.deepEqual(result.works[0].movements[0].medium, ['bass drum'])
  assert.equal(result.changes, 2)
})

test('removes every optional empty array', () => {
  const result = removeEmptyOptionalArrays([{
    identifiers: [],
    key: [],
    medium: [],
    movements: [{
      title: 'I',
      identifiers: [],
      key: ['D Major'],
      medium: [],
    }],
  }, {
    movements: [],
  }])

  assert.deepEqual(result.works[0], {
    movements: [{
      title: 'I',
      key: ['D Major'],
    }],
  })
  assert.deepEqual(result.works[1], {})
  assert.equal(result.removed, 6)
})

test('orders work-level unions by first appearance in movements', () => {
  const firstIdentifier = {
    catalog: 'gmw',
    value: '1',
    display: 'GMW 1',
    primary: false,
  }
  const secondIdentifier = {
    catalog: 'gmw',
    value: '2',
    display: 'GMW 2',
    primary: false,
  }
  const result = orderWorkUnionFields([{
    identifiers: [secondIdentifier, firstIdentifier],
    key: ['G Major', 'C Major'],
    medium: ['strings', 'piano'],
    movements: [{
      identifiers: [firstIdentifier],
      key: ['C Major'],
      medium: ['piano'],
    }, {
      identifiers: [secondIdentifier],
      key: ['G Major'],
      medium: ['strings'],
    }],
  }])

  assert.deepEqual(result.works[0].identifiers, [
    firstIdentifier,
    secondIdentifier,
  ])
  assert.deepEqual(result.works[0].key, ['C Major', 'G Major'])
  assert.deepEqual(result.works[0].medium, ['piano', 'strings'])
  assert.equal(result.changes, 3)
  assert.deepEqual(result.issues, [])
})

test('reports and preserves work-level arrays whose sets do not match movements', () => {
  const result = orderWorkUnionFields([{
    key: ['D Major'],
    movements: [{
      key: ['C Major'],
    }],
  }])

  assert.deepEqual(result.works[0].key, ['D Major'])
  assert.equal(result.changes, 0)
  assert.match(result.issues[0], /does not match the movement union/)
})
