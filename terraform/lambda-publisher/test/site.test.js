/**
 * End-to-end checks over the generated site.
 *
 * `npm test` builds the site against a local stand-in for the Craft API
 * (test/fake-craft.js, serving test/fixtures/craft) and then runs these
 * against `public/`. That exercises the whole pipeline: fetching documents
 * and blocks over HTTP, turning Craft blocks into HTML, mermaid diagrams,
 * Emotion's CSS extraction, typography, and React's server rendering. They
 * are written against the build *output* rather than against components in
 * isolation, because the failures worth catching are the ones that show up
 * on the page.
 *
 * Uses node:test so the suite adds no dependencies of its own.
 */
const test = require("node:test")
const assert = require("node:assert/strict")
const { spawn, spawnSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const {
  SITE_ROOT,
  PUBLIC_DIR,
  allPosts,
  escapeRe,
  prosePhrase,
  readPage,
  text,
  visibleText,
} = require("./helpers")
const fakeCraft = require("./fake-craft")

const config = require(path.join(SITE_ROOT, "site.config"))
const SITE_TITLE = config.title
const posts = allPosts()
const reference = posts.find(p => p.slug === "/formatting-reference/")
const referencePage = () => readPage(reference.slug)

test("the build produced a public directory", () => {
  assert.ok(
    fs.existsSync(PUBLIC_DIR),
    `${PUBLIC_DIR} is missing — run \`npm run test\`, which builds against the fixtures first`
  )
})

test("there is content to test against", () => {
  assert.ok(posts.length > 0, "no fixture documents found in test/fixtures/craft")
  assert.ok(reference, "the formatting reference fixture is missing")
})

test.describe("page generation", () => {
  test("generates the index page", () => {
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, "index.html")))
  })

  test("generates the about page", () => {
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, "about", "index.html")))
  })

  test("generates one page per Craft document, at its slug", () => {
    for (const post of posts) {
      const page = path.join(PUBLIC_DIR, post.slug, "index.html")
      assert.ok(fs.existsSync(page), `expected a page for ${post.file} at ${post.slug}`)
    }
  })

  test("keeps the date-based URLs the Gatsby site used", () => {
    for (const slug of ["2019-10-06", "2019-10-08", "2019-10-19", "2019-10-20", "2020-04-04"]) {
      assert.ok(fs.existsSync(path.join(PUBLIC_DIR, slug, "index.html")), `/${slug}/ is missing`)
    }
  })

  test("copies static files", () => {
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, "favicon.ico")))
  })

  test("leaves no Gatsby artifacts in the output", () => {
    for (const leftover of ["page-data", "_gatsby", "~partytown", "webpack.stats.json"]) {
      assert.ok(!fs.existsSync(path.join(PUBLIC_DIR, leftover)), `${leftover} found in public/`)
    }
  })
})

test.describe("index page", () => {
  const html = () => readPage()

  test("lists every post title and links to its slug", () => {
    const page = text(html())
    for (const post of posts) {
      assert.match(page, new RegExp(escapeRe(post.title)), `missing title: ${post.title}`)
      assert.match(page, new RegExp(`href="${escapeRe(post.slug)}"`), `missing link: ${post.slug}`)
    }
  })

  test("reports the correct post count", () => {
    assert.match(
      visibleText(html()),
      new RegExp(`${posts.length}\\s*Posts`),
      `expected the index to report ${posts.length} posts`
    )
  })

  test("shows each post's formatted date", () => {
    const page = visibleText(html())
    for (const post of posts) {
      assert.ok(page.includes(post.displayDate), `missing date ${post.displayDate} for ${post.file}`)
    }
  })

  test("takes the date from a document titled with one", () => {
    const post = posts.find(p => p.dateSource === "title")
    assert.ok(post, "no fixture is titled with its date")
    assert.ok(visibleText(html()).includes(post.displayDate))
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, post.slug, "index.html")))
  })

  test("falls back to the document's creation date when there is no date", () => {
    const post = posts.find(p => p.dateSource === "created")
    assert.ok(post, "no fixture exercises the creation-date fallback")
    assert.ok(visibleText(html()).includes(post.displayDate))
  })

  test("orders posts newest first", () => {
    const page = text(html())
    const positions = [...posts]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map(p => page.indexOf(`href="${p.slug}"`))
    for (let i = 1; i < positions.length; i++) {
      assert.ok(
        positions[i] > positions[i - 1],
        "posts are not rendered in descending date order"
      )
    }
  })

  test("renders an excerpt for each post", () => {
    const page = visibleText(html())
    for (const post of posts) {
      const phrase = prosePhrase(post.body)
      assert.ok(
        page.includes(phrase),
        `missing excerpt for ${post.file} (expected to find "${phrase}")`
      )
    }
  })

  test("truncates long excerpts where Gatsby did", () => {
    // Taken from the live Gatsby site. The source block is hard-wrapped, so
    // this also checks that line breaks become spaces rather than vanishing.
    assert.ok(
      visibleText(html()).includes(
        "you may face some conflicts with libraries in the com.amazonaws…"
      ),
      "Athena excerpt differs from the live site"
    )
  })

  test("renders the page heading", () => {
    assert.match(visibleText(html()), /Assorted Findings and Musings/)
  })
})

test.describe("post pages", () => {
  for (const post of posts) {
    test(`${post.file} renders title, date, tags and body`, () => {
      const raw = readPage(post.slug)
      const page = visibleText(raw)

      assert.match(text(raw), new RegExp(`<h1>${escapeRe(post.title)}</h1>`), "title heading missing")
      assert.ok(page.includes(post.displayDate), `date ${post.displayDate} missing`)

      for (const tag of post.tags) {
        assert.ok(page.includes(tag), `tag "${tag}" missing`)
      }

      const phrase = prosePhrase(post.body, 8)
      assert.ok(page.includes(phrase), `post body missing (expected "${phrase}")`)
    })

    test(`${post.file} does not render its metadata`, () => {
      const raw = readPage(post.slug)
      const page = visibleText(raw)
      for (const line of post.metaLines) {
        assert.ok(!page.includes(line), `metadata line "${line}" leaked into the page`)
      }
      // The divider under an imported metadata block goes with it.
      assert.doesNotMatch(raw, /<br\/><br\/><div><hr\/>/, "body starts with the metadata divider")
    })
  }
})

test.describe("about page", () => {
  test("renders the site title in its heading", () => {
    assert.match(visibleText(readPage("about")), new RegExp(`About\\s+${escapeRe(SITE_TITLE)}`))
  })
})

test.describe("shared layout", () => {
  const pages = () => ["", "about", ...posts.map(p => p.slug)]

  test("every page shows the site title from site.config", () => {
    for (const p of pages()) {
      assert.ok(
        visibleText(readPage(p)).includes(SITE_TITLE),
        `site title missing on /${p}`
      )
    }
  })

  test("every page links home and to the about page", () => {
    for (const p of pages()) {
      const page = readPage(p)
      assert.match(page, /href="\/"/, `home link missing on /${p}`)
      assert.match(page, /href="\/about\/"/, `about link missing on /${p}`)
    }
  })

  test("every page has a document title", () => {
    for (const p of pages()) {
      assert.match(readPage(p), /<title>[^<]+<\/title>/, `<title> missing on /${p}`)
    }
  })
})

test.describe("Craft block rendering", () => {
  test("renders text blocks as paragraphs", () => {
    assert.match(readPage(posts[0].slug), /<p>/, "no paragraphs rendered")
  })

  test("skips empty spacer blocks", () => {
    for (const post of posts) {
      assert.doesNotMatch(readPage(post.slug), /<p><\/p>/, `empty paragraph on ${post.slug}`)
    }
  })

  test("turns bare URLs into links", () => {
    const withUrl = posts.find(p => /(^|\s)https?:\/\//m.test(p.body))
    assert.ok(withUrl, "no fixture has a bare URL")
    assert.match(readPage(withUrl.slug), /<a href="https?:\/\//, "bare URLs were not linked")
  })

  test("renders headings from textStyle", () => {
    const page = referencePage()
    assert.match(page, /<h2>Inline formatting<\/h2>/)
    assert.match(page, /<h3>Lists<\/h3>/)
  })

  test("renders inline formatting", () => {
    const page = referencePage()
    assert.match(page, /<strong>bold<\/strong>/)
    assert.match(page, /<em>italic<\/em>/)
    assert.match(page, /<code>inline code<\/code>/)
    assert.match(page, /<a href="https:\/\/www\.craft\.do\/">link<\/a>/)
    assert.match(page, /<mark>a highlight<\/mark>/)
  })

  test("groups list items into lists, split by style, with nesting", () => {
    const page = referencePage()
    assert.match(page, /<ul><li><span>First bullet<\/span><ul><li><span>Nested bullet<\/span><\/li><\/ul><\/li><li><span>Second bullet<\/span><\/li><\/ul>/)
    assert.match(page, /<ol><li><span>First step<\/span><\/li><li><span>Second step<\/span><\/li><\/ol>/)
  })

  test("renders tasks as checkboxes reflecting their state", () => {
    const page = referencePage()
    assert.match(page, /<input type="checkbox" disabled="" checked=""\/> <span>Finished task/)
    assert.match(page, /<input type="checkbox" disabled=""\/> <span>Open task/)
  })

  test("renders callouts as blockquotes and captions as small text", () => {
    const page = referencePage()
    assert.match(page, /<blockquote><p>A callout becomes a blockquote\.<\/p><\/blockquote>/)
    assert.match(page, /<p><small>A caption line\.<\/small><\/p>/)
    assert.doesNotMatch(page, /&lt;(callout|caption)/, "Craft tags leaked into the output")
  })

  test("renders code, images, separators, links and cards", () => {
    const page = referencePage()
    assert.match(page, /<pre><code class="language-javascript">const answer = 6 \* 7<\/code><\/pre>/)
    assert.match(page, /<img src="https:\/\/example\.com\/diagram\.png" alt="A diagram"\/>/)
    assert.match(page, /<hr\/>/)
    assert.match(page, /<p><a href="https:\/\/www\.craft\.do\/">Craft<\/a><\/p>/)
    assert.match(page, /<section><h2>A nested card<\/h2><p>Content inside a card\.<\/p><\/section>/)
  })
})

test.describe("mermaid diagrams", () => {
  const isDiagram = b => b.type === "code" && /^(sequenceDiagram|graph|flowchart)\b/.test(b.rawCode)
  const withGraph = posts.filter(p => p.blocks.some(isDiagram))

  test("at least one post has a diagram", () => {
    assert.ok(withGraph.length > 0, "no fixture has a mermaid code block")
  })

  for (const post of withGraph) {
    test(`${post.file} renders its code block as a mermaid container`, () => {
      const page = readPage(post.slug)
      assert.match(page, /<div class="mermaid">/, "mermaid container missing")
      assert.doesNotMatch(page, /<pre><code[^>]*>sequenceDiagram/, "diagram rendered as plain code")

      const source = post.blocks.find(isDiagram).rawCode
      const firstLine = source.split(/\r?\n/)[0].trim()
      assert.ok(
        text(page).includes(firstLine),
        `diagram source "${firstLine}" missing from the container`
      )
      assert.match(page, /<script src="https:\/\/unpkg\.com\/mermaid@8\.13\.4\/dist\/mermaid\.min\.js">/)
    })
  }

  test("pages without diagrams load no scripts", () => {
    for (const p of ["", "about", ...posts.filter(p => !withGraph.includes(p)).map(p => p.slug)]) {
      assert.doesNotMatch(readPage(p), /<script/, `unexpected script on /${p}`)
    }
  })
})

test.describe("styling pipeline (Emotion + typography)", () => {
  test("extracts Emotion styles into the head", () => {
    const page = readPage()
    const head = page.slice(0, page.indexOf("</head>"))
    assert.match(head, /<style data-emotion="css [^"]+">/, "no Emotion style tag in the head")
  })

  test("does not inline Emotion style tags into the body", () => {
    const page = readPage()
    assert.doesNotMatch(page.slice(page.indexOf("<body")), /<style/, "style tags rendered inline")
  })

  test("compiles the layout's css prop to real declarations", () => {
    assert.match(readPage(), /max-width:\s*700px/, "layout max-width rule missing")
  })

  test("applies typography rhythm values", () => {
    // rhythm() emits rem-based spacing; a broken typography setup drops these.
    assert.match(readPage(), /margin-bottom:\s*[\d.]+rem/, "typography rhythm spacing missing")
  })

  test("includes the Kirkham theme's global styles and fonts", () => {
    const page = readPage()
    assert.match(page, /<style id="typography\.js">[^<]*'Playfair Display'/, "typography styles missing")
    assert.match(
      page,
      /<link href="\/\/fonts\.googleapis\.com\/css\?family=Playfair\+Display:700\|Fira\+Sans:[^"]+"/,
      "Google Fonts link missing"
    )
  })

  test("styles the post metadata via the css prop", () => {
    assert.match(readPage(posts[0].slug), /color:\s*#bbb/, "post date/tag styling missing")
  })
})

test.describe("server-side rendering", () => {
  test("renders content into the page rather than an empty shell", () => {
    for (const p of ["", "about", posts[0].slug]) {
      const page = readPage(p)
      const start = page.indexOf('<div id="root">')
      assert.notEqual(start, -1, `could not find the root element on /${p}`)
      assert.ok(
        visibleText(page.slice(start)).length > 100,
        `/${p} rendered an essentially empty root`
      )
    }
  })

  test("does not leak render error markers into the output", () => {
    for (const p of ["", "about", ...posts.map(x => x.slug)]) {
      const page = readPage(p)
      for (const marker of ["TypeError:", "ReferenceError:", "Minified React error", "undefined"]) {
        assert.ok(!page.includes(marker), `"${marker}" found in /${p}`)
      }
    }
  })
})

test.describe("build configuration", () => {
  const build = args =>
    spawnSync(process.execPath, [path.join(SITE_ROOT, ".cache", "build.cjs"), ...args], {
      env: { PATH: process.env.PATH },
      encoding: "utf8",
    })

  test("fails with a clear message when Craft is not configured", () => {
    const result = build([])
    assert.notEqual(result.status, 0, "build succeeded without CRAFT_API_URL")
    assert.match(result.stderr, /Craft API URL is not set \(CRAFT_API_URL locally/)
  })

  test("refuses to build an empty site and leaves the previous output in place", async () => {
    // The scheduled deploy syncs with --delete, so an empty folder must never
    // produce an (empty) public/ that would then be mirrored to the bucket.
    const { server, env } = await fakeCraft.start()
    try {
      const result = await new Promise(resolve => {
        const child = spawn(process.execPath, [path.join(SITE_ROOT, ".cache", "build.cjs")], {
          env: { PATH: process.env.PATH, ...env, CRAFT_FOLDER_ID: fakeCraft.EMPTY_FOLDER_ID },
        })
        let stderr = ""
        child.stderr.on("data", chunk => (stderr += chunk))
        child.on("exit", status => resolve({ status, stderr }))
      })
      assert.notEqual(result.status, 0, "build succeeded with no posts")
      assert.match(result.stderr, /refusing to build an empty site/)
    } finally {
      server.close()
    }
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, "index.html")), "the failed build removed public/")
  })
})
