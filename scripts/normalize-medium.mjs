import fs from 'node:fs'
import path from 'node:path'
import {repositoryRoot} from './lib/catalog.mjs'
import {normalizeMediums} from './lib/works-transforms.mjs'

const worksPath = path.join(repositoryRoot, 'source', 'v2', 'works.json')
const works = JSON.parse(fs.readFileSync(worksPath, 'utf8'))
const result = normalizeMediums(works)

if (result.changes > 0) {
  fs.writeFileSync(worksPath, `${JSON.stringify(result.works, null, 2)}\n`)
}
console.log(`Normalized ${result.changes} medium arrays`)
