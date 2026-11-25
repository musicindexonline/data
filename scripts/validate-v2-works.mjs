import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import Ajv from 'ajv'
import {repositoryRoot} from './lib/catalog.mjs'

const worksPath = path.join(repositoryRoot, 'source', 'v2', 'works.json')
const composersPath = path.join(repositoryRoot, 'source', 'v2', 'composer.json')
const worksSchemaPath = path.join(
  repositoryRoot,
  'schemas',
  'v2',
  'works.schema.json',
)
const composerSchemaPath = path.join(
  repositoryRoot,
  'schemas',
  'v2',
  'composer.schema.json',
)

const allowedKeys = new Set([
  'A Major',
  'A Minor',
  'A-Flat Major',
  'B Major',
  'B Minor',
  'B-Flat Major',
  'B-Flat Minor',
  'C Major',
  'C Minor',
  'C-Flat Major',
  'C-Sharp Major',
  'C-Sharp Minor',
  'D Major',
  'D Minor',
  'D-Flat Major',
  'D-Sharp Minor',
  'E Major',
  'E Minor',
  'E-Flat Major',
  'E-Flat Minor',
  'F Major',
  'F Minor',
  'F-Sharp Major',
  'F-Sharp Minor',
  'G Major',
  'G Minor',
  'G-Flat Major',
  'G-Sharp Minor',
])

const mediumPattern = /^[a-z0-9]+(?:[ -][a-z0-9]+)*$/
const workFieldsCheckedForEmptiness = ['identifiers', 'key', 'medium', 'movements']
const movementFieldsCheckedForEmptiness = ['identifiers', 'key', 'medium']

function sameStringSet(left, right) {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  if (leftSet.size !== rightSet.size) return false
  return [...leftSet].every((value) => rightSet.has(value))
}

function sameSequence(left, right) {
  return left.length === right.length
    && left.every((value, index) => value === right[index])
}

function uniqueBy(values, identity = (value) => value) {
  const seen = new Set()
  return values.filter((value) => {
    const key = identity(value)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function identifierIdentity(identifier) {
  return `${identifier?.catalog}\0${identifier?.value}`
}

function identifierLabel(identifier) {
  return identifier?.display
    || `${identifier?.catalog ?? '?'} ${identifier?.value ?? '?'}`
}

function warningForEmptyFields(record, location, fields, warnings) {
  for (const field of fields) {
    if (
      Object.hasOwn(record, field)
      && (record[field] === null
        || (Array.isArray(record[field]) && record[field].length === 0))
    ) {
      warnings.push(`${location}.${field} is empty and should be omitted`)
    }
  }
}

function validateIdentifierList(identifiers, location, errors) {
  if (!Array.isArray(identifiers)) return

  const primaryCount = identifiers.filter(
    (identifier) => identifier?.primary === true,
  ).length
  if (primaryCount > 1) {
    errors.push(`${location} has more than one primary identifier`)
  }

  const keys = identifiers.map(identifierIdentity)
  if (new Set(keys).size !== keys.length) {
    errors.push(`${location} has duplicate identifiers`)
  }
}

function validateValueVocabulary(record, field, location, errors) {
  if (!Array.isArray(record[field])) return

  for (const value of record[field]) {
    if (typeof value !== 'string') continue
    if (field === 'key' && !allowedKeys.has(value)) {
      errors.push(
        `${location}.key contains unsupported key "${value}"`,
      )
    }
    if (field === 'medium' && !mediumPattern.test(value)) {
      errors.push(
        `${location}.medium contains invalid value "${value}"`,
      )
    }
  }
}

function movementUnion(movements, field) {
  const values = movements.flatMap((movement) => (
    Array.isArray(movement[field]) ? movement[field] : []
  ))
  if (field === 'identifiers') {
    return uniqueBy(values, identifierIdentity)
  }
  return uniqueBy(values)
}

function formatUnion(field, values) {
  return JSON.stringify(
    field === 'identifiers' ? values.map(identifierLabel) : values,
  )
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

export function validateWorkRelations(works, composers) {
  const errors = []
  const warnings = []
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

    const movements = Array.isArray(work.movements)
      ? work.movements.filter(
          (movement) => movement && typeof movement === 'object' && !Array.isArray(movement),
        )
      : []

    warningForEmptyFields(
      work,
      location,
      workFieldsCheckedForEmptiness,
      warnings,
    )
    validateIdentifierList(work.identifiers, `${location}.identifiers`, errors)
    validateValueVocabulary(work, 'key', location, errors)
    validateValueVocabulary(work, 'medium', location, errors)

    movements.forEach((movement, movementIndex) => {
      const movementLocation = `${location}.movements[${movementIndex}]`
      warningForEmptyFields(
        movement,
        movementLocation,
        movementFieldsCheckedForEmptiness,
        warnings,
      )
      validateIdentifierList(
        movement.identifiers,
        `${movementLocation}.identifiers`,
        errors,
      )
      validateValueVocabulary(movement, 'key', movementLocation, errors)
      validateValueVocabulary(movement, 'medium', movementLocation, errors)
    })

    for (const field of ['key', 'medium']) {
      const union = movementUnion(movements, field)
      if (union.length === 0) continue
      if (!Object.hasOwn(work, field)) {
        errors.push(`${location}.${field} is required by movement ${field} values`)
        continue
      }
      if (!Array.isArray(work[field])) continue
      if (!sameStringSet(work[field], union)) {
        errors.push(
          `${location}.${field} must equal the union of movement ${field} values ${formatUnion(field, union)}`,
        )
        continue
      }
      const workSequence = uniqueBy(work[field])
      if (!sameSequence(workSequence, union)) {
        warnings.push(
          `${location}.${field} should follow first-appearance order ${formatUnion(field, union)}`,
        )
      }
    }

    const hasMovementIdentifiers = movements.some(
      (movement) => Array.isArray(movement.identifiers)
        && movement.identifiers.length > 0,
    )
    if (hasMovementIdentifiers) {
      const union = movementUnion(movements, 'identifiers')
      if (!Object.hasOwn(work, 'identifiers')) {
        errors.push(`${location}.identifiers is required by movement identifiers`)
      } else if (Array.isArray(work.identifiers)) {
        if (!sameStringSet(
          work.identifiers.map(identifierIdentity),
          union.map(identifierIdentity),
        )) {
          errors.push(
            `${location}.identifiers must equal the union of movement identifiers ${formatUnion('identifiers', union)}`,
          )
        } else {
          const workSequence = uniqueBy(work.identifiers, identifierIdentity)
          if (!sameSequence(
            workSequence.map(identifierIdentity),
            union.map(identifierIdentity),
          )) {
            warnings.push(
              `${location}.identifiers should follow first-appearance order ${formatUnion('identifiers', union)}`,
            )
          }
        }
      }
    }
  })

  return {errors, warnings}
}

export async function validateV2Works() {
  const [works, composers, worksSchema, composerSchema] = await Promise.all([
    readFile(worksPath, 'utf8').then(JSON.parse),
    readFile(composersPath, 'utf8').then(JSON.parse),
    readFile(worksSchemaPath, 'utf8').then(JSON.parse),
    readFile(composerSchemaPath, 'utf8').then(JSON.parse),
  ])
  const ajv = new Ajv({allErrors: true, strict: true})
  const validateWorks = ajv.compile(worksSchema)
  const validateComposers = ajv.compile(composerSchema)
  const errors = []

  if (!validateWorks(works)) {
    errors.push(
      ...validateWorks.errors.map(
        (error) => `${error.instancePath || '/'} ${error.message}`,
      ),
    )
  }
  if (!validateComposers(composers)) {
    errors.push(
      ...validateComposers.errors.map(
        (error) => `composer${error.instancePath || '/'} ${error.message}`,
      ),
    )
  }
  const relations = validateWorkRelations(works, composers)
  errors.push(...relations.errors)
  return {
    valid: errors.length === 0,
    errors,
    warnings: relations.warnings,
    works,
    composers,
  }
}

const isMain =
  process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  const result = await validateV2Works()
  if (result.warnings.length > 0) {
    console.warn(
      `Warnings (${result.warnings.length}):\n${result.warnings.join('\n')}`,
    )
  }
  if (!result.valid) {
    console.error(result.errors.join('\n'))
    process.exitCode = 1
  } else {
    console.log(
      `Verified ${result.works.length} Schema v2 works with ${result.warnings.length} warnings`,
    )
  }
}
