import assert from 'node:assert/strict'
import test from 'node:test'
import {formatWorks} from '../scripts/lib/works-format.mjs'

test('formats works with the custom catalog layout', () => {
  const works = [{
    composerId: 'pyotr-ilyich-tchaikovsky',
    workId: 'pyotr-ilyich-tchaikovsky-symphony-no-4-in-f-minor-th-27',
    title: {preferred: 'Symphony No. 4 in F Minor'},
    identifiers: [
      {catalog: 'th', value: '27', display: 'TH 27', primary: true},
      {catalog: 'op', value: '36', display: 'Op. 36', primary: false},
    ],
    genre: 'Symphony',
    key: ['F Minor', 'B-Flat Minor', 'A-Flat Major', 'F Major'],
    medium: [
      'piccolo',
      'flute',
      'oboe',
      'clarinet',
      'bassoon',
      'horn',
      'trumpet',
      'trombone',
      'tuba',
      'timpani',
      'percussion',
      'strings',
    ],
    movements: [
      {title: 'I. Andante sostenuto - Moderato con anima', key: ['F Minor']},
      {
        title: 'II. Andantino in modo di canzone',
        key: ['B-Flat Minor', 'A-Flat Major'],
      },
      {
        title: 'III. Scherzo. Pizzicato ostinato - Allegro',
        key: ['F Major'],
      },
      {title: 'IV. Finale. Allegro con fuoco', key: ['F Major']},
    ],
  }]

  assert.equal(formatWorks(works), `[
  {
    "composerId": "pyotr-ilyich-tchaikovsky",
    "workId": "pyotr-ilyich-tchaikovsky-symphony-no-4-in-f-minor-th-27",
    "title": { "preferred": "Symphony No. 4 in F Minor" },
    "identifiers": [
      { "catalog": "th", "value": "27", "display": "TH 27", "primary": true },
      { "catalog": "op", "value": "36", "display": "Op. 36", "primary": false }
    ],
    "genre": "Symphony",
    "key": ["F Minor", "B-Flat Minor", "A-Flat Major", "F Major"],
    "medium": ["piccolo", "flute", "oboe", "clarinet", "bassoon", "horn", "trumpet", "trombone", "tuba", "timpani", "percussion", "strings"],
    "movements": [
      { "title": "I. Andante sostenuto - Moderato con anima", "key": ["F Minor"] },
      { "title": "II. Andantino in modo di canzone", "key": ["B-Flat Minor", "A-Flat Major"] },
      { "title": "III. Scherzo. Pizzicato ostinato - Allegro", "key": ["F Major"] },
      { "title": "IV. Finale. Allegro con fuoco", "key": ["F Major"] }
    ]
  }
]
`)
})
