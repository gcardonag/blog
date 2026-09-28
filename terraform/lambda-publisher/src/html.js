/**
 * Renders a page component to a complete static HTML document.
 *
 * Replaces what Gatsby's SSR did for this site: typography.js's global styles
 * and Google Fonts link in the head (formerly gatsby-plugin-typography, which
 * rendered react-typography's TypographyStyle and GoogleFont), and
 * the page's Emotion styles extracted into a single style tag (formerly
 * gatsby-plugin-emotion). No client-side React is shipped; the pages are
 * static.
 */
import React from "react"
import { renderToStaticMarkup, renderToString } from "react-dom/server"
import { CacheProvider } from "@emotion/react"
import createCache from "@emotion/cache"
import createEmotionServer from "@emotion/server/create-instance"

import typography from "./utils/typography"

// Same URL react-typography's GoogleFont built from the theme.
const GOOGLE_FONTS_HREF =
  "//fonts.googleapis.com/css?family=" +
  (typography.options.googleFonts || [])
    .map(font => `${font.name.split(" ").join("+")}:${font.styles.join(",")}`)
    .join("|")

// The version and theme gatsby-remark-graph loaded.
const MERMAID_SRC = "https://unpkg.com/mermaid@8.13.4/dist/mermaid.min.js"

export function renderDocument(page, { title, mermaid = false }) {
  const cache = createCache({ key: "css" })
  // Also switches the cache to collecting styles for extraction instead of
  // inlining them next to elements.
  const { extractCritical } = createEmotionServer(cache)

  const { html, css, ids } = extractCritical(
    renderToString(<CacheProvider value={cache}>{page}</CacheProvider>)
  )

  const head = renderToStaticMarkup(
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
      <title>{title}</title>
      <link rel="icon" href="/favicon.ico" />
      <style id="typography.js" dangerouslySetInnerHTML={{ __html: typography.toString() }} />
      <link href={GOOGLE_FONTS_HREF} rel="stylesheet" type="text/css" />
    </>
  )
  const emotionStyle = `<style data-emotion="css ${ids.join(" ")}">${css}</style>`
  const scripts = mermaid
    ? `<script src="${MERMAID_SRC}"></script>` +
      `<script>mermaid.initialize({ theme: "default", startOnLoad: true })</script>`
    : ""

  return (
    `<!DOCTYPE html><html lang="en"><head>${head}${emotionStyle}</head>` +
    `<body><div id="root">${html}</div>${scripts}</body></html>`
  )
}
