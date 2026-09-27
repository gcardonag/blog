/**
 * Static site build: fetches posts from Craft and writes the site to public/.
 * Run with `yarn build`.
 */
import fs from "fs"
import path from "path"
import React from "react"

import config from "../site.config"
import { createCraftClient } from "./craft/client"
import { loadPosts } from "./craft/posts"
import { hasMermaid } from "./craft/blocks"
import { renderDocument } from "./html"
import IndexPage from "./pages/index"
import AboutPage from "./pages/about"
import BlogPost from "./templates/blog-post"

const ROOT = path.resolve(__dirname, "..")
const PUBLIC_DIR = path.join(ROOT, "public")
const STATIC_DIR = path.join(ROOT, "static")

function writePage(urlPath, html) {
  const file = path.join(PUBLIC_DIR, urlPath, "index.html")
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, html)
}

async function build() {
  const client = createCraftClient(config.craft)
  const posts = await loadPosts(client, config.craft.folderId)

  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true })
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })
  fs.cpSync(STATIC_DIR, PUBLIC_DIR, { recursive: true })

  writePage("/", renderDocument(<IndexPage posts={posts} />, { title: config.title }))
  writePage("/about/", renderDocument(<AboutPage />, { title: `About ${config.title}` }))
  for (const post of posts) {
    writePage(
      post.slug,
      renderDocument(<BlogPost post={post} />, {
        title: `${post.title} | ${config.title}`,
        mermaid: hasMermaid(post.blocks),
      })
    )
  }

  console.log(`Built ${posts.length} posts into ${path.relative(process.cwd(), PUBLIC_DIR) || "."}`)
}

build().catch(err => {
  console.error(err)
  process.exit(1)
})
