/**
 * End-to-end checks over the generated site.
 *
 * These run against `public/` after `gatsby build`, so they exercise the whole
 * pipeline the dependency tree is responsible for: sourcing markdown, the
 * remark transform, the mermaid plugin, Emotion's CSS-in-JS extraction,
 * typography, and React SSR. They are intentionally written against the build
 * *output* rather than against components in isolation, because the failures
 * worth catching here are the ones a dependency upgrade causes downstream —
 * a plugin silently no-opping, or SSR emitting an empty shell.
 *
 * Uses node:test so the suite adds no dependencies of its own.
 */
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const path = require("path")

const {
  SITE_ROOT,
  PUBLIC_DIR,
  allPosts,
  prosePhrase,
  readPage,
  text,
  visibleText,
} = require("./helpers")

const SITE_TITLE = require(path.join(SITE_ROOT, "gatsby-config")).siteMetadata.title
const posts = allPosts()

test("the build produced a public directory", () => {
  assert.ok(
    fs.existsSync(PUBLIC_DIR),
    `${PUBLIC_DIR} is missing — run \`yarn build\` before the tests`
  )
})

test("there is content to test against", () => {
  assert.ok(posts.length > 0, "no markdown posts found in content/posts")
})

test.describe("page generation", () => {
  test("generates the index page", () => {
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, "index.html")))
  })

  test("generates the about page", () => {
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, "about", "index.html")))
  })

  test("generates one page per markdown post, at its slug", () => {
    for (const post of posts) {
      const page = path.join(PUBLIC_DIR, post.slug, "index.html")
      assert.ok(fs.existsSync(page), `expected a page for ${post.file} at ${post.slug}`)
    }
  })

  test("does not generate a Gatsby dev-only 404 page into production output", () => {
    // Gatsby emits 404.html in production; the dev-only page must not leak.
    assert.ok(!fs.existsSync(path.join(PUBLIC_DIR, "dev-404-page", "index.html")))
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
  }
})

test.describe("about page", () => {
  test("renders the site title in its heading", () => {
    assert.match(visibleText(readPage("about")), new RegExp(`About\\s+${escapeRe(SITE_TITLE)}`))
  })
})

test.describe("shared layout", () => {
  const pages = () => ["", "about", ...posts.map(p => p.slug)]

  test("every page shows the site title from gatsby-config", () => {
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
})

test.describe("markdown transform (gatsby-transformer-remark)", () => {
  test("converts markdown to HTML rather than emitting raw source", () => {
    const page = readPage(posts[0].slug)
    assert.match(page, /<p>/, "no paragraphs rendered — markdown was not transformed")
  })

  test("converts markdown links into anchors", () => {
    const withLink = posts.find(p => /\[[^\]]+\]\(https?:\/\//.test(p.body) || /^https?:\/\//m.test(p.body))
    if (!withLink) return // no post currently exercises links
    assert.match(readPage(withLink.slug), /<a href="https?:\/\//, "markdown links were not converted")
  })

  test("converts markdown lists into list elements", () => {
    const withList = posts.find(p => /^\s*[-*]\s+/m.test(p.body))
    if (!withList) return
    assert.match(readPage(withList.slug), /<(ul|ol)>/, "markdown lists were not converted")
  })
})

test.describe("mermaid diagrams (gatsby-remark-graph)", () => {
  const withGraph = posts.filter(p => /```mermaid/.test(p.body))

  test("at least one post exercises the mermaid plugin", () => {
    assert.ok(withGraph.length > 0, "no post contains a ```mermaid fence")
  })

  for (const post of withGraph) {
    test(`${post.file} renders its fence as a mermaid container`, () => {
      const page = readPage(post.slug)
      assert.match(page, /<div class="mermaid">/, "mermaid container missing")
      assert.doesNotMatch(page, /```mermaid/, "raw mermaid fence leaked into the output")

      // The diagram source should survive into the container.
      const source = post.body.match(/```mermaid\r?\n([\s\S]*?)```/)[1].trim()
      const firstLine = source.split(/\r?\n/)[0].trim()
      assert.ok(
        text(page).includes(firstLine),
        `diagram source "${firstLine}" missing from the container`
      )
    })
  }
})

test.describe("styling pipeline (Emotion + typography)", () => {
  test("extracts Emotion styles into the server-rendered HTML", () => {
    const page = readPage()
    assert.match(page, /data-emotion="css/, "no Emotion style tags — CSS-in-JS did not run at build time")
  })

  test("compiles the layout's css prop to real declarations", () => {
    // layout.js sets max-width via the css prop; if the Emotion Babel preset
    // stops running, the class name survives but the rule does not.
    assert.match(readPage(), /max-width:\s*700px/, "layout max-width rule missing")
  })

  test("applies typography rhythm values", () => {
    // rhythm() emits rem-based spacing; a broken typography plugin drops these.
    assert.match(readPage(), /margin-bottom:\s*[\d.]+rem/, "typography rhythm spacing missing")
  })

  test("styles the post metadata via the css prop", () => {
    assert.match(readPage(posts[0].slug), /color:\s*#bbb/, "post date/tag styling missing")
  })
})

test.describe("server-side rendering", () => {
  test("renders content into the Gatsby root rather than an empty shell", () => {
    for (const p of ["", "about", posts[0].slug]) {
      const page = readPage(p)
      const start = page.indexOf('<div id="___gatsby">')
      assert.notEqual(start, -1, `could not find the Gatsby root element on /${p}`)

      // Everything from the root up to the first script tag is server-rendered
      // markup; an unhydrated shell would leave this essentially empty.
      const rendered = page.slice(start, page.indexOf("<script", start))
      assert.ok(
        visibleText(rendered).length > 100,
        `/${p} rendered an essentially empty root — SSR likely failed`
      )
    }
  })

  test("does not leak SSR error markers into the output", () => {
    for (const p of ["", "about", ...posts.map(x => x.slug)]) {
      const page = readPage(p)
      for (const marker of ["TypeError:", "ReferenceError:", "Minified React error"]) {
        assert.ok(!page.includes(marker), `"${marker}" found in /${p}`)
      }
    }
  })

  test("emits the client runtime bundle", () => {
    assert.match(readPage(), /<script[^>]+src="\/[^"]*\.js"/, "no client bundle referenced")
  })
})

test.describe("deploy configuration", () => {
  const config = require(path.join(SITE_ROOT, "gatsby-config"))

  test("keeps the S3 plugin configured for the blog bucket", () => {
    const s3 = config.plugins.find(
      p => typeof p === "object" && /gatsby-plugin-s3$/.test(p.resolve)
    )
    assert.ok(s3, "the S3 deploy plugin is no longer configured")
    assert.equal(s3.options.bucketName, "blog.gcardona.me")
    assert.equal(s3.options.region, "us-east-1")
    // The bucket is fronted by CloudFront; a non-null ACL breaks the deploy.
    assert.equal(s3.options.acl, null)
  })

  test("the S3 plugin resolves to an installed package", () => {
    const s3 = config.plugins.find(
      p => typeof p === "object" && /gatsby-plugin-s3$/.test(p.resolve)
    )
    assert.doesNotThrow(
      () => require.resolve(s3.resolve, { paths: [SITE_ROOT] }),
      `${s3.resolve} is configured but not installed`
    )
  })
})

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
