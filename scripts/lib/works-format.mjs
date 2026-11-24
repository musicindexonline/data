const workFieldOrder = [
  'composerId',
  'workId',
  'title',
  'identifiers',
  'genre',
  'key',
  'medium',
  'period',
  'movements',
]
const identifierFieldOrder = ['catalog', 'value', 'display', 'primary']
const movementFieldOrder = ['title', 'identifiers', 'key', 'medium']
const titleFieldOrder = ['preferred', 'alias']

function orderedEntries(value, preferredOrder) {
  const known = preferredOrder.filter((field) => Object.hasOwn(value, field))
  const remaining = Object.keys(value).filter((field) => !preferredOrder.includes(field))
  return [...known, ...remaining].map((field) => [field, value[field]])
}

function inlineObject(value) {
  const fields = Object.keys(value)
  const fieldOrder = fields.some((field) => identifierFieldOrder.includes(field))
    ? identifierFieldOrder
    : fields.includes('preferred')
      ? titleFieldOrder
      : movementFieldOrder
  const entries = orderedEntries(value, fieldOrder)
  if (entries.length === 0) return '{}'
  return `{ ${entries
    .map(([field, nested]) => `${JSON.stringify(field)}: ${inlineValue(nested)}`)
    .join(', ')} }`
}

function inlineValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map(inlineValue).join(', ')}]`
  }
  if (value && typeof value === 'object') return inlineObject(value)
  return JSON.stringify(value)
}

function listField(name, values, indent) {
  if (values.length === 0) return `${indent}${JSON.stringify(name)}: []`
  const itemIndent = `${indent}  `
  const items = values.map((value) => `${itemIndent}${inlineObject(value)}`)
  return [
    `${indent}${JSON.stringify(name)}: [`,
    items.join(',\n'),
    `${indent}]`,
  ].join('\n')
}

function formatWork(work) {
  const blocks = orderedEntries(work, workFieldOrder).map(([field, value]) => {
    if (field === 'identifiers') return listField(field, value, '    ')
    if (field === 'movements') return listField(field, value, '    ')
    return `    ${JSON.stringify(field)}: ${inlineValue(value)}`
  })
  return `  {\n${blocks.join(',\n')}\n  }`
}

export function formatWorks(works) {
  if (works.length === 0) return '[]\n'
  return `[\n${works.map(formatWork).join(',\n')}\n]\n`
}
