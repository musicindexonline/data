import {channels, verifyPublishedRelease} from './lib/catalog.mjs'
import {validateV2Works} from './validate-v2-works.mjs'

const v2Validation = await validateV2Works()
if (!v2Validation.valid) {
  throw new Error(
    `Schema v2 validation failed:\n${v2Validation.errors.join('\n')}`,
  )
}

for (const channelId of Object.keys(channels)) {
  const result = await verifyPublishedRelease(channelId)
  console.log(
    `Verified Schema ${result.channel.version} catalog ${result.catalogVersion}`,
  )
}
