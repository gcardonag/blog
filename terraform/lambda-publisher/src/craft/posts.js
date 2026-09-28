/**
 * Turns the documents in a Craft folder into blog posts.
 *
 * Each document is one post. Optional metadata lines at the very top of the
 * document play the role front matter used to:
 *
 *   title: My Post         defaults to the document's title
 *   date: 2020-04-04       defaults to the document's title if that is a date,
 *                          otherwise to the document's creation date
 *   tags: azure, iam, aws  comma-separated
 *   slug: my-post          defaults to the date, so URLs look like /2020-04-04/
 *
 * Labels may be bold ("**Tags:** azure"), several lines may share one block,
 * and a divider directly after them is treated as part of the metadata. A
 * "source file" line (left by the markdown import) is accepted and ignored.
 * All of it is removed from the rendered body.
 */
import { plainText } from "./blocks"

const META_KEYS = new Set(["title", "date", "tags", "slug", "source file"])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const EXCERPT_LENGTH = 140

export async function loadPosts(client, folderId) {
  if (!folderId) {
    throw new Error("The Craft folder ID is not set (CRAFT_FOLDER_ID locally, folderId in the Lambda's settings).")
  }

  const documents = await client.listDocuments(folderId)
  // The deploy mirrors public/ into the bucket and deletes what's missing, so
  // an empty result (wrong folder, API hiccup) would take the whole site down.
  if (documents.length === 0) {
    throw new Error(`Craft folder ${folderId} has no documents; refusing to build an empty site.`)
  }
  const posts = await Promise.all(
    documents.map(async doc => toPost(doc, await client.getDocumentBlocks(doc.id)))
  )

  const seen = new Map()
  for (const post of posts) {
    if (seen.has(post.slug)) {
      throw new Error(
        `"${post.title}" and "${seen.get(post.slug)}" both resolve to ${post.slug}; give one a "slug:" line`
      )
    }
    seen.set(post.slug, post.title)
  }

  return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export function toPost(doc, root) {
  const { meta, body } = splitMetadata(root.content || [])

  const date =
    meta.date || (ISO_DATE.test(doc.title) ? doc.title : (doc.createdAt || "").slice(0, 10))
  if (!ISO_DATE.test(date)) {
    throw new Error(`"${doc.title}" needs a "date: YYYY-MM-DD" line (got "${date}")`)
  }

  const slug = (meta.slug || date).replace(/^\/+|\/+$/g, "")

  return {
    id: doc.id,
    title: meta.title || doc.title,
    date,
    displayDate: formatDate(date),
    slug: `/${slug}/`,
    tags: meta.tags
      ? meta.tags.split(",").map(t => t.trim()).filter(Boolean)
      : [],
    excerpt: prune(plainText(body), EXCERPT_LENGTH),
    blocks: body,
  }
}

function splitMetadata(blocks) {
  const meta = {}
  let i = 0
  for (; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.type !== "text") break
    const text = (block.markdown || "").trim()
    if (!text) continue // spacer lines between metadata are fine
    const fields = parseMetaLines(text)
    if (!fields) break
    Object.assign(meta, fields)
  }
  const hasMeta = Object.keys(meta).length > 0
  if (hasMeta && blocks[i] && blocks[i].type === "line") i++
  return { meta, body: blocks.slice(i) }
}

/** Parses a block whose every line is "key: value"; null if any line isn't. */
function parseMetaLines(text) {
  const fields = {}
  for (const line of text.split("\n")) {
    const match = line.replace(/\*\*/g, "").trim().match(/^([a-z ]+):\s*(.*)$/i)
    const key = match && match[1].trim().toLowerCase()
    if (!match || !META_KEYS.has(key)) return null
    fields[key] = match[2].trim()
  }
  return fields
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/** "2020-04-04" -> "04 April, 2020", the format the site has always used. */
export function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number)
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]}, ${year}`
}

/**
 * Shortens text to a word boundary. A port of underscore.string's prune(),
 * which Gatsby used for excerpts, so the cut lands where it always has: the
 * last partial word is dropped, with punctuation such as "." counting as a
 * word boundary (so "com.amazonaws.auth" can be cut after "com.amazonaws").
 */
function prune(text, length, pruneStr = "…") {
  if (text.length <= length) return text
  const letterOrSpace = c => (c.toUpperCase() !== c.toLowerCase() ? "A" : " ")
  let template = text.slice(0, length + 1).replace(/.(?=\W*\w*$)/g, letterOrSpace)
  if (/\w\w/.test(template.slice(-2))) {
    template = template.replace(/\s*\S+$/, "")
  } else {
    template = template.slice(0, -1).trimEnd()
  }
  return (template + pruneStr).length > text.length
    ? text
    : text.slice(0, template.length) + pruneStr
}
