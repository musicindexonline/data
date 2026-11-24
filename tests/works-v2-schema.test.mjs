import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import Ajv from 'ajv'
import {repositoryRoot} from '../scripts/lib/catalog.mjs'

test('Schema v2 works accepts the agreed compact structure', async () => {
  const schema = JSON.parse(
    await readFile(
      path.join(repositoryRoot, 'schemas', 'v2', 'works.schema.json'),
      'utf8',
    ),
  )
  const works = [
    {
      composerId: 'pyotr-ilyich-tchaikovsky',
      workId: 'pyotr-ilyich-tchaikovsky-violin-concerto-in-d-major-th-59',
      title: {preferred: 'Violin Concerto in D Major'},
      identifiers: [
        {catalog: 'op', value: '35', display: 'Op. 35', primary: true},
        {catalog: 'th', value: '59', display: 'TH 59', primary: false},
      ],
      medium: ['violin', 'orchestra'],
      genre: 'Concerto',
      key: ['D Major'],
      movements: [
        {
          title: 'I. Allegro moderato',
          identifiers: [
            {catalog: 'th', value: '59', display: 'TH 59', primary: false},
          ],
          key: ['D Major'],
        },
        {title: 'II. Canzonetta. Andante', key: ['D Major']},
        {title: 'III. Finale. Allegro vivacissimo', key: ['D Major']},
      ],
    },
    {
      composerId: 'gustav-mahler',
      workId: 'gustav-mahler-symphony-no-2-in-c-minor',
      title: {
        preferred: 'Symphony No. 2 in C Minor',
        alias: 'Resurrection',
      },
      identifiers: [
        {catalog: 'gmw', value: '30', display: 'GMW 30', primary: false},
      ],
      medium: ['orchestra', 'soprano', 'alto', 'chorus'],
      genre: 'Symphony',
      key: ['C Minor'],
      movements: [
        {
          title: "IV. 'Urlicht'. Sehr feierlich, aber schlicht",
          key: ['C Minor'],
          medium: ['alto', 'orchestra'],
        },
      ],
    },
    {
      composerId: 'gustav-mahler',
      workId: 'gustav-mahler-minimal-fields',
      title: {preferred: 'Minimal Fields'},
      genre: 'Symphony',
    },
    {
      composerId: 'gustav-mahler',
      workId: 'gustav-mahler-empty-optional-fields',
      title: {preferred: 'Empty Optional Fields'},
      identifiers: [],
      genre: 'Symphony',
      key: [],
      medium: [],
      movements: [],
    },
  ]

  const ajv = new Ajv({allErrors: true, strict: true})
  const validate = ajv.compile(schema)
  assert.equal(validate(works), true, ajv.errorsText(validate.errors))
})

test('Schema v2 identifiers require exactly catalog, value, display, and primary', async () => {
  const schema = JSON.parse(
    await readFile(
      path.join(repositoryRoot, 'schemas', 'v2', 'works.schema.json'),
      'utf8',
    ),
  )
  const works = [{
    composerId: 'test-composer',
    workId: 'test-composer-work',
    title: {preferred: 'Work'},
    identifiers: [{
      catalog: 'test',
      value: '1',
      display: 'T 1',
    }],
    genre: 'Symphony',
  }]

  const ajv = new Ajv({allErrors: true, strict: true})
  const validate = ajv.compile(schema)
  assert.equal(validate(works), false)
  assert.ok(validate.errors.some(
    (error) => error.keyword === 'required'
      && error.params.missingProperty === 'primary',
  ))
})

test('Schema v2 movements only allow title, identifiers, key, and medium', async () => {
  const schema = JSON.parse(
    await readFile(
      path.join(repositoryRoot, 'schemas', 'v2', 'works.schema.json'),
      'utf8',
    ),
  )
  const works = [{
    composerId: 'test-composer',
    workId: 'test-composer-work',
    title: {preferred: 'Work'},
    genre: 'Symphony',
    movements: [{
      title: 'I',
      tempo: 'Allegro',
    }],
  }]

  const ajv = new Ajv({allErrors: true, strict: true})
  const validate = ajv.compile(schema)
  assert.equal(validate(works), false)
  assert.ok(validate.errors.some(
    (error) => error.keyword === 'additionalProperties'
      && error.params.additionalProperty === 'tempo',
  ))
})
