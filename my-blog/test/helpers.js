const fs = require("fs")
const path = require("path")

const SITE_ROOT = path.resolve(__dirname, "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const POSTS_DIR = path.join(SITE_ROOT, "content", "posts")

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/**
 * Minimal front matter reader. Deliberately hand-rolled rather than pulled from
 * a package: these tests exist to verify the build output independently of the
 * dependency tree they are checking, so they should not share parsing code with
 * it.
 */
function parsePost(file) {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8")
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) throw new Error(`${file} has no front matter block`)

  const [, frontMatter, body] = match
  const fields = {}
  for (const line of frontMatter.split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (kv) fields[kv[1]] = kv[2].trim()
  }

  const tags = fields.tags
    ? JSON.parse(fields.tags.replace(/'/g, '"'))
    : []

  return {
    file,
    // gatsby-node derives the slug from the file path via createFilePath
    slug: `/${path.basename(file, ".md")}/`,
    title: fields.title,
    date: fields.date,
    displayDate: formatDate(fields.date),
    tags,
    body,
  }
}

/** Mirrors the GraphQL `date(formatString: "DD MMMM, YYYY")` used by the templates. */
function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number)
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]}, ${year}`
}

function allPosts() {
  return fs
    .readdirSync(POSTS_DIR)
    .filter(f => f.endsWith(".md"))
    .map(parsePost)
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
    .replace(/&nbsp;|\u00a0/g, " ")
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
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
  return decodeEntities(stripped).replace(/\s+/g, " ").trim()
}

/**
 * A short run of plain words taken from near the start of a post body, used to
 * assert the prose actually made it into the rendered page. Markdown structure
 * (list markers, headings, code fences, inline links) is skipped so the probe
 * is a contiguous run of words that survives the remark transform intact.
 */
function prosePhrase(body, wordCount = 5) {
  const cleaned = body
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> their text
    .replace(/^\s*[-*+]\s+/gm, " ") // list markers
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

module.exports = {
  SITE_ROOT,
  PUBLIC_DIR,
  POSTS_DIR,
  allPosts,
  formatDate,
  prosePhrase,
  readPage,
  text,
  visibleText,
}
