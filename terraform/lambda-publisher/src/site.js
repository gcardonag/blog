/**
 * Generates the whole site in memory from Craft content. Used by the Lambda
 * (src/handler.js), which syncs it into the S3 bucket, and by the local
 * preview build (src/build.js), which writes it to public/.
 */
import fs from "fs"
import path from "path"
import React from "react"

import { title as siteTitle } from "../site.config"
import { createCraftClient } from "./craft/client"
import { loadPosts } from "./craft/posts"
import { hasMermaid } from "./craft/blocks"
import { renderDocument } from "./html"
import IndexPage from "./pages/index"
import AboutPage from "./pages/about"
import BlogPost from "./templates/blog-post"

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
}

function contentType(key) {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] || "application/octet-stream"
}

/**
 * Returns the site as a list of files keyed by their path in the bucket
 * ("index.html", "about/index.html", "favicon.ico", ...).
 *
 * @param craft      { apiUrl, apiKey, folderId }
 * @param staticDir  directory whose files are published as-is
 */
export async function generateSite({ craft, staticDir }) {
  const client = createCraftClient(craft)
  const posts = await loadPosts(client, craft.folderId)

  const files = []
  const addPage = (urlPath, html) => {
    const key = `${urlPath.replace(/^\/+/, "")}index.html`
    files.push({ key, body: Buffer.from(html), contentType: contentType(key) })
  }

  addPage("/", renderDocument(<IndexPage posts={posts} />, { title: siteTitle }))
  addPage("/about/", renderDocument(<AboutPage />, { title: `About ${siteTitle}` }))
  for (const post of posts) {
    addPage(
      post.slug,
      renderDocument(<BlogPost post={post} />, {
        title: `${post.title} | ${siteTitle}`,
        mermaid: hasMermaid(post.blocks),
      })
    )
  }

  for (const file of listFiles(staticDir)) {
    const key = path.relative(staticDir, file).split(path.sep).join("/")
    files.push({ key, body: fs.readFileSync(file), contentType: contentType(key) })
  }

  return { files, posts }
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? listFiles(full) : [full]
  })
}
