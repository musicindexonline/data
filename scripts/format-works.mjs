import fs from 'node:fs'
import path from 'node:path'
import {repositoryRoot} from './lib/catalog.mjs'
import {formatWorks} from './lib/works-format.mjs'

const worksPath = path.join(repositoryRoot, 'source', 'v2', 'works.json')
const works = JSON.parse(fs.readFileSync(worksPath, 'utf8'))
const formatted = formatWorks(works)

if (formatted !== fs.readFileSync(worksPath, 'utf8')) {
  fs.writeFileSync(worksPath, formatted)
  console.log(`Formatted ${works.length} works`)
} else {
  console.log(`Formatted ${works.length} works (no changes)`)
}
