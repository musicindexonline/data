const optionalWorkArrayFields = ['identifiers', 'key', 'medium', 'movements']
const optionalMovementArrayFields = ['identifiers', 'key', 'medium']

function clone(value) {
  return structuredClone(value)
}

function identifierIdentity(identifier) {
  return `${identifier?.catalog}\0${identifier?.value}`
}

function identifierLabel(identifier) {
  return identifier?.display
    || `${identifier?.catalog ?? '?'} ${identifier?.value ?? '?'}`
}

function uniqueBy(values, identity) {
  const seen = new Set()
  return values.filter((value) => {
    const key = identity(value)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sameStringSet(left, right) {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  return leftSet.size === rightSet.size
    && [...leftSet].every((value) => rightSet.has(value))
}

export function normalizeMediumValue(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeMediums(works) {
  const transformed = clone(works)
  let changes = 0

  const normalizeWork = (work) => {
    if (Array.isArray(work.medium)) {
      const normalized = work.medium.map((value) => (
        typeof value === 'string' ? normalizeMediumValue(value) : value
      ))
      if (normalized.some((value, index) => value !== work.medium[index])) {
        changes++
        work.medium = normalized
      }
    }

    if (!Array.isArray(work.movements)) return
    for (const movement of work.movements) {
      if (!Array.isArray(movement.medium)) continue
      const normalized = movement.medium.map((value) => (
        typeof value === 'string' ? normalizeMediumValue(value) : value
      ))
      if (normalized.some((value, index) => value !== movement.medium[index])) {
        changes++
        movement.medium = normalized
      }
    }
  }

  for (const work of transformed) normalizeWork(work)
  return {works: transformed, changes}
}

export function removeEmptyOptionalArrays(works) {
  const transformed = clone(works)
  let removed = 0

  for (const work of transformed) {
    for (const field of optionalWorkArrayFields) {
      if (Array.isArray(work[field]) && work[field].length === 0) {
        delete work[field]
        removed++
      }
    }

    if (!Array.isArray(work.movements)) continue
    for (const movement of work.movements) {
      for (const field of optionalMovementArrayFields) {
        if (Array.isArray(movement[field]) && movement[field].length === 0) {
          delete movement[field]
          removed++
        }
      }
    }
  }

  return {works: transformed, removed}
}

export function orderWorkUnionFields(works) {
  const transformed = clone(works)
  const issues = []
  let changes = 0

  transformed.forEach((work, workIndex) => {
    if (!Array.isArray(work.movements)) return

    for (const field of ['key', 'medium']) {
      const union = uniqueBy(
        work.movements.flatMap((movement) => (
          Array.isArray(movement[field]) ? movement[field] : []
        )),
        (value) => value,
      )
      if (union.length === 0) continue
      if (!Array.isArray(work[field])) {
        issues.push(`works[${workIndex}].${field} is missing the movement union`)
        continue
      }

      if (!sameStringSet(work[field], union)) {
        issues.push(
          `works[${workIndex}].${field} does not match the movement union ${JSON.stringify(union)}`,
        )
        continue
      }

      const byValue = new Map(work[field].map((value) => [value, value]))
      const ordered = union.map((value) => byValue.get(value))
      if (JSON.stringify(ordered) !== JSON.stringify(work[field])) {
        work[field] = ordered
        changes++
      }
    }

    const hasMovementIdentifiers = work.movements.some(
      (movement) => Array.isArray(movement.identifiers)
        && movement.identifiers.length > 0,
    )
    if (!hasMovementIdentifiers) return

    const union = uniqueBy(
      work.movements.flatMap((movement) => (
        Array.isArray(movement.identifiers) ? movement.identifiers : []
      )),
      identifierIdentity,
    )
    if (!Array.isArray(work.identifiers)) {
      issues.push(`works[${workIndex}].identifiers is missing the movement union`)
      return
    }
    if (!sameStringSet(
      work.identifiers.map(identifierIdentity),
      union.map(identifierIdentity),
    )) {
      issues.push(
        `works[${workIndex}].identifiers does not match the movement union ${JSON.stringify(union.map(identifierLabel))}`,
      )
      return
    }

    const byIdentity = new Map(
      work.identifiers.map((identifier) => [identifierIdentity(identifier), identifier]),
    )
    const ordered = union.map((identifier) => byIdentity.get(identifierIdentity(identifier)))
    if (JSON.stringify(ordered) !== JSON.stringify(work.identifiers)) {
      work.identifiers = ordered
      changes++
    }
  })

  return {works: transformed, changes, issues}
}
