/**
 * A local stand-in for the Craft API that serves the JSON in
 * test/fixtures/craft, so the build can run end to end without touching a
 * real Craft space. It checks the request the way the real API would: the
 * Bearer key, the folder, and the block id.
 */
const http = require("http")
const fs = require("fs")
const path = require("path")

const FIXTURES = path.join(__dirname, "fixtures", "craft")
const FOLDER_ID = "fixture-folder"
const EMPTY_FOLDER_ID = "empty-folder"
const API_KEY = "fixture-api-key"
const BASE_PATH = "/links/fixture-link/api/v1"

function readJson(...segments) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, ...segments), "utf8"))
}

function handle(req, res) {
  const url = new URL(req.url, "http://localhost")
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" })
    res.end(JSON.stringify(body))
  }

  if (req.headers.authorization !== `Bearer ${API_KEY}`) return send(401, { error: "Unauthorized" })
  if (req.method !== "GET") return send(405, { error: "Read-only fixture server" })

  if (url.pathname === `${BASE_PATH}/documents`) {
    if (url.searchParams.get("folderId") === EMPTY_FOLDER_ID) return send(200, { items: [] })
    if (url.searchParams.get("folderId") !== FOLDER_ID) return send(404, { error: "Unknown folder" })
    return send(200, readJson("documents.json"))
  }

  if (url.pathname === `${BASE_PATH}/blocks`) {
    const id = url.searchParams.get("id") || ""
    const file = path.join(FIXTURES, "blocks", `${path.basename(id)}.json`)
    if (!fs.existsSync(file)) return send(404, { error: "Unknown block" })
    return send(200, readJson("blocks", `${path.basename(id)}.json`))
  }

  send(404, { error: "Not found" })
}

/** Starts the server; resolves to the env vars that point a build at it. */
function start() {
  const server = http.createServer(handle)
  return new Promise(resolve => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address()
      resolve({
        server,
        env: {
          CRAFT_API_URL: `http://127.0.0.1:${port}${BASE_PATH}`,
          CRAFT_API_KEY: API_KEY,
          CRAFT_FOLDER_ID: FOLDER_ID,
        },
      })
    })
  })
}

module.exports = { start, FIXTURES, EMPTY_FOLDER_ID }
