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
        {catalog: 'th', value: '59', display: 'TH 59'},
      ],
      medium: ['violin', 'orchestra'],
      genre: 'Concerto',
      key: ['D Major'],
      movements: [
        {title: 'I. Allegro moderato', key: ['D Major']},
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
  ]

  const ajv = new Ajv({allErrors: true, strict: true})
  const validate = ajv.compile(schema)
  assert.equal(validate(works), true, ajv.errorsText(validate.errors))
})
