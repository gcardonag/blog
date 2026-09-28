/**
 * Serves public/ locally, resolving /path/ to /path/index.html the way the
 * S3 website endpoint does. Usage: yarn serve [port]
 */
const http = require("http")
const fs = require("fs")
const path = require("path")

const publicDir = path.resolve(__dirname, "..", "public")
const port = Number(process.argv[2]) || 9000

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".css": "text/css",
  ".js": "text/javascript",
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
    let file = path.join(publicDir, urlPath)
    if (!file.startsWith(publicDir)) {
      res.writeHead(403).end()
      return
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html")

    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found")
        return
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" })
      res.end(body)
    })
  })
  .listen(port, () => console.log(`Serving ${publicDir} at http://localhost:${port}`))
