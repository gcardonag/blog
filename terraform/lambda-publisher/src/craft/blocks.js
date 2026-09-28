/**
 * Renders Craft API blocks as HTML.
 *
 * Structure comes from the block fields (type, textStyle, listStyle,
 * indentationLevel, decorations). Each block's `markdown` field is only used
 * for its inline formatting — bold, links, code spans and so on — after the
 * block-level prefix Craft adds ("# ", "- ", "- [ ] ") has been stripped.
 */
import React from "react"
import { marked } from "marked"

const HEADINGS = { h1: "h1", h2: "h2", h3: "h3", h4: "h4" }
const LIST_STYLES = new Set(["bullet", "numbered", "task", "toggle"])

// Craft has no "mermaid" code language, so diagrams are recognised by the
// keyword that opens them.
const MERMAID_START =
  /^(sequenceDiagram|graph|flowchart|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline)\b/

export function isMermaid(block) {
  if (block.type !== "code") return false
  if (block.language === "mermaid") return true
  return MERMAID_START.test((block.rawCode || "").trimStart())
}

/** True if any block in the tree is a mermaid diagram. */
export function hasMermaid(blocks) {
  return blocks.some(b => isMermaid(b) || hasMermaid(b.content || []))
}

/** Converts a block's markdown to inline HTML. */
export function inlineHtml(markdown) {
  const source = stripBlockPrefix(markdown)
    .replace(/<highlight(?:\s[^>]*)?>/g, "<mark>")
    .replace(/<\/highlight>/g, "</mark>")
    .replace(/<\/?(callout|caption|page|pageTitle)>/g, "")
  return marked.parseInline(source, { gfm: true, breaks: true })
}

function stripBlockPrefix(markdown = "") {
  return markdown
    .replace(/^#{1,6}\s+/, "") // headings
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "") // tasks
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, "") // bullets and numbers
    .replace(/^>\s?/, "") // quotes
}

/** Plain text of the prose blocks, used for excerpts. */
export function plainText(blocks) {
  const parts = []
  for (const block of blocks) {
    if (block.type === "text" && block.markdown) {
      parts.push(stripTags(inlineHtml(block.markdown)))
    }
    if (block.content) parts.push(plainText(block.content))
  }
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
}

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/g, " ") // line breaks inside a block separate words
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}

export function Blocks({ blocks }) {
  return <>{groupBlocks(blocks).map(renderGroup)}</>
}

/**
 * Craft stores list items and callouts as sibling blocks; HTML needs them
 * wrapped. Consecutive list items and consecutive callouts are grouped here.
 */
function groupBlocks(blocks) {
  const groups = []
  for (const block of blocks) {
    const kind = groupKind(block)
    const last = groups[groups.length - 1]
    if (kind && last && last.kind === kind) {
      last.blocks.push(block)
    } else {
      groups.push({ kind, blocks: [block] })
    }
  }
  return groups
}

function groupKind(block) {
  if (block.type !== "text") return null
  if (LIST_STYLES.has(block.listStyle)) return "list"
  const decorations = block.decorations || []
  if (decorations.includes("callout") || decorations.includes("quote")) return "quote"
  return null
}

function renderGroup(group) {
  const key = group.blocks[0].id
  if (group.kind === "list") return renderLists(group.blocks)
  if (group.kind === "quote") {
    return (
      <blockquote key={key}>
        {group.blocks.map(b => renderText({ ...b, decorations: [] }))}
      </blockquote>
    )
  }
  return renderBlock(group.blocks[0])
}

/**
 * Splits consecutive list items into separate lists wherever the list style
 * changes at the same level, e.g. a bullet list followed by a numbered one.
 */
function renderLists(items) {
  const runs = []
  for (const item of items) {
    const level = item.indentationLevel || 0
    const run = runs[runs.length - 1]
    if (run && (level > run.level || item.listStyle === run.style)) {
      run.items.push(item)
    } else {
      runs.push({ level, style: item.listStyle, items: [item] })
    }
  }
  return runs.map(run => renderList(run.items))
}

/** Builds a (possibly nested) list from flat items using indentationLevel. */
function renderList(items) {
  const [first] = items
  const level = first.indentationLevel || 0
  const Tag = first.listStyle === "numbered" ? "ol" : "ul"

  const children = []
  let i = 0
  while (i < items.length) {
    const item = items[i]
    const nested = []
    let j = i + 1
    while (j < items.length && (items[j].indentationLevel || 0) > level) nested.push(items[j++])
    children.push(
      <li key={item.id}>
        {renderListItem(item)}
        {nested.length > 0 && renderLists(nested)}
      </li>
    )
    i = j
  }
  return <Tag key={first.id}>{children}</Tag>
}

function renderListItem(item) {
  const text = <span dangerouslySetInnerHTML={{ __html: inlineHtml(item.markdown) }} />
  if (item.listStyle === "task") {
    const done = item.taskInfo && item.taskInfo.state === "done"
    return (
      <>
        <input type="checkbox" disabled checked={done} /> {text}
      </>
    )
  }
  if (item.listStyle === "toggle" && item.content && item.content.length) {
    return (
      <details>
        <summary>{text}</summary>
        <Blocks blocks={item.content} />
      </details>
    )
  }
  return text
}

function renderText(block) {
  if (!block.markdown || !block.markdown.trim()) return null // Craft spacer
  const html = { __html: inlineHtml(block.markdown) }

  const Heading = HEADINGS[block.textStyle]
  if (Heading) return <Heading key={block.id} dangerouslySetInnerHTML={html} />
  if (block.textStyle === "caption") {
    return (
      <p key={block.id}>
        <small dangerouslySetInnerHTML={html} />
      </p>
    )
  }
  return <p key={block.id} dangerouslySetInnerHTML={html} />
}

function renderBlock(block) {
  switch (block.type) {
    case "text":
      return renderText(block)

    case "code":
      if (isMermaid(block)) {
        return (
          <div key={block.id} className="mermaid">
            {block.rawCode}
          </div>
        )
      }
      return (
        <pre key={block.id}>
          <code className={block.language ? `language-${block.language}` : undefined}>
            {block.rawCode}
          </code>
        </pre>
      )

    case "image":
      return (
        <p key={block.id}>
          <img src={block.url} alt={block.altText || ""} />
        </p>
      )

    case "line":
      return <hr key={block.id} />

    case "richUrl":
    case "video":
    case "file":
      return (
        <p key={block.id}>
          <a href={block.url}>{block.title || block.fileName || block.url}</a>
        </p>
      )

    case "table":
      // The API exposes tables only through their markdown serialisation.
      return <div key={block.id} dangerouslySetInnerHTML={{ __html: marked.parse(block.markdown || "") }} />

    case "page":
    case "collectionItem": {
      // A nested page or card: its title becomes a section heading.
      const title = block.title && block.title.markdown ? block.title.markdown : block.markdown
      return (
        <section key={block.id}>
          <h2 dangerouslySetInnerHTML={{ __html: inlineHtml(title) }} />
          <Blocks blocks={block.content || []} />
        </section>
      )
    }

    default:
      // Drawings, whiteboards and collections have no static rendering.
      console.warn(`Skipping unsupported Craft block type "${block.type}" (${block.id})`)
      return null
  }
}
