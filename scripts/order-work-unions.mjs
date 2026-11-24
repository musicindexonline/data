import fs from 'node:fs'
import path from 'node:path'
import {repositoryRoot} from './lib/catalog.mjs'
import {orderWorkUnionFields} from './lib/works-transforms.mjs'

const worksPath = path.join(repositoryRoot, 'source', 'v2', 'works.json')
const works = JSON.parse(fs.readFileSync(worksPath, 'utf8'))
const result = orderWorkUnionFields(works)

if (result.changes > 0) {
  fs.writeFileSync(worksPath, `${JSON.stringify(result.works, null, 2)}\n`)
}
if (result.issues.length > 0) {
  console.warn(result.issues.join('\n'))
}
console.log(`Reordered ${result.changes} work-level union arrays`)
