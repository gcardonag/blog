const fs = require("fs")
const path = require("path")

const SITE_ROOT = path.resolve(__dirname, "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const FIXTURES_DIR = path.join(__dirname, "fixtures", "craft")

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function readFixture(...segments) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, ...segments), "utf8"))
}

/**
 * Reads one fixture document the way a reader of the Craft doc would.
 * Deliberately hand-rolled rather than shared with src/craft: these tests
 * verify the build output, so they should not reuse the code under test.
 */
function parsePost(doc) {
  const root = readFixture("blocks", `${doc.id}.json`)
  // Metadata is either one "key: value" line per block, or (as the markdown
  // import left it) one block of "**Key:** value" lines followed by a divider.
  const fields = {}
  const metaLines = []
  let i = 0
  for (; i < root.content.length; i++) {
    const lines = (root.content[i].markdown || "").split("\n")
    const pairs = lines.map(l => l.replace(/\*\*/g, "").match(/^(title|date|tags|slug|source file):\s*(.*)$/i))
    if (root.content[i].type !== "text" || pairs.some(p => !p)) break
    for (const [line, key, value] of pairs) {
      fields[key.toLowerCase()] = value.trim()
      metaLines.push(line)
    }
  }
  if (i > 0 && root.content[i] && root.content[i].type === "line") i++
  const body = root.content.slice(i)
  const isoTitle = /^\d{4}-\d{2}-\d{2}$/.test(doc.title) ? doc.title : null
  const date = fields.date || isoTitle || doc.createdAt.slice(0, 10)

  return {
    file: `${doc.id}.json`,
    slug: `/${fields.slug || date}/`,
    title: fields.title || doc.title,
    date,
    displayDate: formatDate(date),
    dateSource: fields.date ? "metadata" : isoTitle ? "title" : "created",
    tags: fields.tags ? fields.tags.split(",").map(t => t.trim()) : [],
    metaLines,
    blocks: body,
    body: body
      .filter(b => b.type === "text")
      .map(b => b.markdown)
      .join("\n\n"),
  }
}

/** Mirrors the "DD MMMM, YYYY" format the site has always used. */
function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number)
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]}, ${year}`
}

function allPosts() {
  return readFixture("documents.json").items.map(parsePost)
}

function readPage(...segments) {
  return fs.readFileSync(path.join(PUBLIC_DIR, ...segments, "index.html"), "utf8")
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&") // last, so "&amp;lt;" does not become "<"
}

/**
 * Normalises rendered HTML for comparisons that still care about markup:
 * React inserts `<!-- -->` separators between adjacent text nodes, and
 * entity-encodes characters such as apostrophes.
 */
function text(html) {
  return decodeEntities(html.replace(/<!--[\s\S]*?-->/g, ""))
}

/**
 * Visible copy only. Tags are stripped *before* entities are decoded, so prose
 * containing characters like `<->` (encoded in the output) is not mistaken for
 * markup and discarded.
 */
function visibleText(html) {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<head[\s\S]*?<\/head>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
  return decodeEntities(stripped).replace(/\s+/g, " ").trim()
}

/**
 * A short run of plain words taken from near the start of a post body, used to
 * assert the prose actually made it into the rendered page. Markdown syntax
 * inside Craft blocks (list markers, headings, code spans, inline links) is
 * skipped so the probe is a contiguous run of words that renders verbatim.
 */
function prosePhrase(body, wordCount = 5) {
  const cleaned = body
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> their text
    .replace(/<\/?(callout|caption|highlight|page|pageTitle)\b[^>]*>/g, " ") // Craft tags
    .replace(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/gm, " ") // list and task markers
    .replace(/^\s*#{1,6}\s+/gm, " ") // headings
    .replace(/[*_>]/g, " ")

  // Longest-first scan for a contiguous run of purely alphabetic words, which
  // renders identically in HTML and so can be matched verbatim.
  const words = cleaned.split(/\s+/)
  let run = []
  for (const w of words) {
    if (/^[A-Za-z]+$/.test(w)) {
      run.push(w)
      if (run.length === wordCount) return run.join(" ")
    } else {
      run = []
    }
  }
  throw new Error(`could not find ${wordCount} consecutive plain words in post body`)
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

module.exports = {
  SITE_ROOT,
  PUBLIC_DIR,
  allPosts,
  escapeRe,
  formatDate,
  prosePhrase,
  readPage,
  text,
  visibleText,
}
