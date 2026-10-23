import {createServer} from 'node:http'
import {readFile, stat} from 'node:fs/promises'
import path from 'node:path'
import {publicDirectory} from './lib/catalog.mjs'

const port = Number(process.env.PORT || 4174)
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

function resolveRequestPath(pathname) {
  const relativePath = pathname.replace(/^\/+/, '')
  const resolved = path.resolve(publicDirectory, relativePath)
  const rootPrefix = `${publicDirectory}${path.sep}`
  if (resolved !== publicDirectory && !resolved.startsWith(rootPrefix)) {
    return null
  }
  return resolved
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
    let pathname
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      response.writeHead(400).end('Bad request')
      return
    }

    let filePath = resolveRequestPath(pathname)
    if (!filePath) {
      response.writeHead(403).end('Forbidden')
      return
    }

    try {
      const fileStats = await stat(filePath)
      if (fileStats.isDirectory()) {
        filePath = path.join(filePath, 'index.html')
      }
    } catch {
      response.writeHead(404).end('Not found')
      return
    }

    const body = await readFile(filePath)
    const extension = path.extname(filePath)
    const isManifest = path.basename(filePath) === 'stable.json'
    response.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      'Cache-Control': isManifest ? 'no-store' : 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    })
    response.end(body)
  } catch (error) {
    console.error(error)
    response.writeHead(500).end('Internal server error')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Local data server: http://127.0.0.1:${port}`)
})
