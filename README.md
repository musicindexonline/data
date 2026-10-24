# Music Index Online Data

This repository publishes the runtime catalog for
[Music Index Online](https://musicindexonline.github.io/).

## Publishing

1. Edit the files under `source/v1/`.
2. Run `npm run release`.
3. Run `npm test` and `npm run verify`.
4. Commit the source and generated files under `public/v1/`.

The data version is derived from the content of `music.json` and
`composerMap.json`. Existing version directories are immutable.

Source and published files are canonicalized to LF line endings, so releases
produce the same hashes on Windows and Linux.

## Schema v2 migration

Schema v2 work is in progress. The composer source has been migrated to
`source/v2/composer.json`, and both v2 Schemas are defined. `works.json` has not
yet been migrated or published. The v1 catalog remains the stable runtime
channel.

Validate the in-progress v2 works with:

```powershell
npm run verify:v2:works
```

When every movement has `key` or `medium`, the corresponding work-level array
must equal the union of those movement arrays.

## Routes

- `/v1/stable.json`: current Schema v1 manifest
- `/v1/versions/<catalog-version>/music.json`
- `/v1/versions/<catalog-version>/composerMap.json`

Schema v1 keeps the existing JSON structure unchanged. A future breaking data
model will be published under `/v2/` while Schema v1 remains available during
the transition.
