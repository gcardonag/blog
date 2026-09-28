/**
 * Local preview build: fetches posts from Craft and writes the site to
 * public/ (`yarn build`, `yarn preview`). It generates exactly what the
 * Lambda (src/handler.js) publishes to the live site.
 */
import fs from "fs"
import path from "path"

import config from "../site.config"
import { generateSite } from "./site"

const ROOT = path.resolve(__dirname, "..")
const PUBLIC_DIR = path.join(ROOT, "public")
const STATIC_DIR = path.join(ROOT, "static")

async function build() {
  // Generate everything before touching public/, so a failed fetch leaves the
  // previous build in place.
  const { files, posts } = await generateSite({ craft: config.craft, staticDir: STATIC_DIR })

  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true })
  for (const file of files) {
    const target = path.join(PUBLIC_DIR, file.key)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, file.body)
  }

  console.log(`Built ${posts.length} posts into ${path.relative(process.cwd(), PUBLIC_DIR) || "."}`)
}

build().catch(err => {
  console.error(err)
  process.exit(1)
})
