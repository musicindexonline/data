import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import Ajv from 'ajv'
import {repositoryRoot} from './lib/catalog.mjs'

const worksPath = path.join(repositoryRoot, 'source', 'v2', 'works.json')
const composersPath = path.join(repositoryRoot, 'source', 'v2', 'composer.json')
const schemaPath = path.join(repositoryRoot, 'schemas', 'v2', 'works.schema.json')

function sameStringSet(left, right) {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  if (leftSet.size !== rightSet.size) return false
  return [...leftSet].every((value) => rightSet.has(value))
}

export function workIdFromWork(work) {
  const primary = (work.identifiers || []).find(
    (identifier) => identifier.primary === true,
  )
  const normalizePart = (part) => part
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  const parts = [normalizePart(work.title.preferred)]
  if (primary) {
    parts.push(normalizePart(primary.display || `${primary.catalog} ${primary.value}`))
  }

  return [work.composerId, ...parts].filter(Boolean).join('-')
}

function validateWorkRelations(works, composers) {
  const errors = []
  const composerIds = new Set(composers.map((composer) => composer.id))
  const workIds = new Set()

  works.forEach((work, workIndex) => {
    const location = `works[${workIndex}]`
    if (!composerIds.has(work.composerId)) {
      errors.push(`${location}.composerId does not reference an existing composer`)
    }

    if (workIds.has(work.workId)) {
      errors.push(`${location}.workId is duplicated`)
    }
    workIds.add(work.workId)
    const expectedWorkId = workIdFromWork(work)
    if (work.workId !== expectedWorkId) {
      errors.push(
        `${location}.workId must be "${expectedWorkId}"`,
      )
    }

    const identifiers = work.identifiers || []
    const primaryCount = identifiers.filter((identifier) => identifier.primary === true).length
    if (primaryCount > 1) {
      errors.push(`${location} has more than one primary identifier`)
    }
    const identifierKeys = identifiers.map(
      (identifier) => `${identifier.catalog}\0${identifier.value}`,
    )
    if (new Set(identifierKeys).size !== identifierKeys.length) {
      errors.push(`${location} has duplicate identifiers`)
    }

    for (const field of ['key', 'medium']) {
      if (work.movements.length === 0) continue
      const everyMovementHasField = work.movements.every(
        (movement) => Object.hasOwn(movement, field),
      )
      if (!everyMovementHasField) continue

      if (!Object.hasOwn(work, field)) {
        errors.push(`${location}.${field} is required when every movement has ${field}`)
        continue
      }

      const movementUnion = [
        ...new Set(work.movements.flatMap((movement) => movement[field])),
      ]
      if (!sameStringSet(work[field], movementUnion)) {
        errors.push(
          `${location}.${field} must equal the union of all movement ${field} values`,
        )
      }
    }
  })

  return errors
}

export async function validateV2Works() {
  const [works, composers, schema] = await Promise.all([
    readFile(worksPath, 'utf8').then(JSON.parse),
    readFile(composersPath, 'utf8').then(JSON.parse),
    readFile(schemaPath, 'utf8').then(JSON.parse),
  ])
  const ajv = new Ajv({allErrors: true, strict: true})
  const validate = ajv.compile(schema)
  const errors = []

  if (!validate(works)) {
    errors.push(
      ...validate.errors.map(
        (error) => `${error.instancePath || '/'} ${error.message}`,
      ),
    )
  }
  errors.push(...validateWorkRelations(works, composers))
  return {valid: errors.length === 0, errors, works, composers}
}

const isMain =
  process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  const result = await validateV2Works()
  if (!result.valid) {
    console.error(result.errors.join('\n'))
    process.exitCode = 1
  } else {
    console.log(`Verified ${result.works.length} Schema v2 works`)
  }
}
