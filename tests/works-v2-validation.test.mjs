import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validateWorkRelations,
  validateV2Works,
  workIdFromWork,
} from '../scripts/validate-v2-works.mjs'

test('current v2 works produce a structured validation report', async () => {
  const result = await validateV2Works()
  assert.ok(Array.isArray(result.errors))
  assert.ok(Array.isArray(result.warnings))
  assert.equal(result.valid, result.errors.length === 0)
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
})

test('empty optional fields warn while missing fields are allowed', () => {
  const result = validateWorkRelations(
    [
      {
        composerId: 'test-composer',
        workId: 'test-composer-minimal',
        title: {preferred: 'Minimal'},
        genre: 'Symphony',
      },
      {
        composerId: 'test-composer',
        workId: 'test-composer-empty-fields',
        title: {preferred: 'Empty Fields'},
        identifiers: [],
        genre: 'Symphony',
        key: [],
        medium: [],
        movements: [{
          title: 'I',
          identifiers: [],
          key: [],
          medium: [],
        }],
      },
    ],
    [{id: 'test-composer'}],
  )

  assert.deepEqual(result.errors, [])
  assert.equal(
    result.warnings.filter((warning) => warning.includes('is empty and should be omitted')).length,
    6,
  )
})

test('movement unions validate membership, vocabulary, and order', () => {
  const firstIdentifier = {
    catalog: 'test',
    value: '1',
    display: 'T 1',
    primary: false,
  }
  const secondIdentifier = {
    catalog: 'test',
    value: '2',
    display: 'T 2',
    primary: false,
  }
  const result = validateWorkRelations(
    [{
      composerId: 'test-composer',
      workId: 'test-composer-union',
      title: {preferred: 'Union'},
      identifiers: [secondIdentifier, firstIdentifier],
      genre: 'Symphony',
      key: ['G Major', 'C Major'],
      medium: ['strings', 'bass_drum'],
      movements: [
        {
          title: 'I',
          identifiers: [firstIdentifier],
          key: ['C Major'],
          medium: ['strings', 'bass_drum'],
        },
        {
          title: 'II',
          identifiers: [secondIdentifier],
          key: ['G Major'],
          medium: ['strings'],
        },
      ],
    }],
    [{id: 'test-composer'}],
  )

  assert.deepEqual(
    result.errors,
    [
      'works[0].medium contains invalid value "bass_drum"',
      'works[0].movements[0].medium contains invalid value "bass_drum"',
    ],
  )
  assert.ok(result.warnings.some(
    (warning) => warning.includes('key should follow first-appearance order'),
  ))
  assert.ok(result.warnings.some(
    (warning) => warning.includes('identifiers should follow first-appearance order'),
  ))
})

test('movement identifiers require a work-level union', () => {
  const result = validateWorkRelations(
    [{
      composerId: 'test-composer',
      workId: 'test-composer-missing-union',
      title: {preferred: 'Missing Union'},
      genre: 'Symphony',
      movements: [{
        title: 'I',
        identifiers: [{
          catalog: 'test',
          value: '1',
          display: 'T 1',
          primary: false,
        }],
      }],
    }],
    [{id: 'test-composer'}],
  )

  assert.ok(result.errors.some(
    (error) => error.includes('.identifiers is required by movement identifiers'),
  ))
})

test('key values are restricted to the hard-coded camel-case vocabulary', () => {
  const result = validateWorkRelations(
    [{
      composerId: 'test-composer',
      workId: 'test-composer-invalid-key',
      title: {preferred: 'Invalid Key'},
      genre: 'Symphony',
      key: ['D major'],
    }],
    [{id: 'test-composer'}],
  )

  assert.deepEqual(
    result.errors,
    ['works[0].key contains unsupported key "D major"'],
  )
})
