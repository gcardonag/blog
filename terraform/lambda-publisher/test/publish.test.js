/**
 * Checks the Lambda as packaged (dist/index.js, built by `npm run package`),
 * with the fixture Craft server standing in for Craft and in-memory stand-ins
 * for S3 and SSM.
 */
const test = require("node:test")
const assert = require("node:assert/strict")
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const fakeCraft = require("./fake-craft")
const { allPosts } = require("./helpers")

const BUNDLE_DIR = path.resolve(__dirname, "..", "dist")
const lambda = require(path.join(BUNDLE_DIR, "index.js"))
const posts = allPosts()

const md5 = body => crypto.createHash("md5").update(body).digest("hex")

/** An in-memory bucket implementing the interface syncToBucket() uses. */
function memoryBucket(initial = {}) {
  const objects = new Map(Object.entries(initial).map(([k, v]) => [k, { body: Buffer.from(v) }]))
  const calls = []
  return {
    objects,
    calls,
    async list() {
      return new Map([...objects].map(([key, o]) => [key, md5(o.body)]))
    },
    async put(file) {
      calls.push(["put", file.key])
      objects.set(file.key, file)
    },
    async remove(keys) {
      calls.push(["remove", ...keys])
      for (const key of keys) objects.delete(key)
    },
  }
}

async function withCraft(fn) {
  const { server, env } = await fakeCraft.start()
  const settings = { apiUrl: env.CRAFT_API_URL, apiKey: env.CRAFT_API_KEY, folderId: env.CRAFT_FOLDER_ID }
  try {
    return await fn(settings)
  } finally {
    server.close()
  }
}

const publish = (settings, bucket) =>
  lambda.publish({ settings, bucket, staticDir: path.join(BUNDLE_DIR, "static") })

test.describe("packaged Lambda", () => {
  test("exports the handler the Lambda configuration points at", () => {
    assert.equal(typeof lambda.handler, "function")
  })

  test("leaves the AWS SDK to the runtime instead of bundling it", () => {
    const source = fs.readFileSync(path.join(BUNDLE_DIR, "index.js"), "utf8")
    assert.match(source, /import\("@aws-sdk\/client-s3"\)/)
    assert.doesNotMatch(source, /class S3Client/)
  })

  test("ships the static files", () => {
    assert.ok(fs.existsSync(path.join(BUNDLE_DIR, "static", "favicon.ico")))
  })
})

test.describe("publishing into the bucket", () => {
  test("uploads every page and static file with content type and cache headers", async () => {
    const bucket = memoryBucket()
    const summary = await withCraft(settings => publish(settings, bucket))

    const expected = ["index.html", "about/index.html", "favicon.ico", ...posts.map(p => `${p.slug.slice(1)}index.html`)]
    assert.deepEqual([...bucket.objects.keys()].sort(), expected.sort())
    assert.equal(summary.posts, posts.length)

    const index = bucket.objects.get("index.html")
    assert.equal(index.contentType, "text/html; charset=utf-8")
    assert.equal(index.cacheControl, "public, max-age=0, must-revalidate")
    assert.match(index.body.toString(), /Assorted Findings and Musings/)
    assert.equal(bucket.objects.get("favicon.ico").contentType, "image/x-icon")
  })

  test("uploads the index last, after the pages it links to", async () => {
    const bucket = memoryBucket()
    await withCraft(settings => publish(settings, bucket))
    const puts = bucket.calls.filter(c => c[0] === "put").map(c => c[1])
    assert.equal(puts[puts.length - 1], "index.html")
  })

  test("skips unchanged files and deletes ones the site no longer has", async () => {
    const bucket = memoryBucket({ "old-post/index.html": "<p>gone</p>" })
    await withCraft(settings => publish(settings, bucket))
    assert.ok(!bucket.objects.has("old-post/index.html"), "stale page was not deleted")

    bucket.calls.length = 0
    const second = await withCraft(settings => publish(settings, bucket))
    assert.equal(second.uploaded, 0, "unchanged files were uploaded again")
    assert.equal(second.deleted, 0)
    assert.deepEqual(bucket.calls, [])
  })

  test("leaves the bucket untouched when Craft returns no posts", async () => {
    const bucket = memoryBucket({ "index.html": "<p>live site</p>" })
    await withCraft(settings =>
      assert.rejects(
        publish({ ...settings, folderId: fakeCraft.EMPTY_FOLDER_ID }, bucket),
        /refusing to build an empty site/
      )
    )
    assert.deepEqual(bucket.calls, [])
    assert.equal(bucket.objects.get("index.html").body.toString(), "<p>live site</p>")
  })

  test("leaves the bucket untouched when Craft rejects the credentials", async () => {
    const bucket = memoryBucket({ "index.html": "<p>live site</p>" })
    await withCraft(settings =>
      assert.rejects(publish({ ...settings, apiKey: "wrong" }, bucket), /401/)
    )
    assert.deepEqual(bucket.calls, [])
  })
})

test.describe("S3 adapter", () => {
  function fakeS3(pages) {
    const calls = []
    return {
      calls,
      async listObjectsV2(params) {
        calls.push(["listObjectsV2", params])
        const i = params.ContinuationToken ? Number(params.ContinuationToken) : 0
        return {
          Contents: pages[i],
          IsTruncated: i + 1 < pages.length,
          NextContinuationToken: String(i + 1),
        }
      },
      async putObject(params) {
        calls.push(["putObject", params])
      },
      async deleteObjects(params) {
        calls.push(["deleteObjects", params])
        return {}
      },
    }
  }

  test("lists every page of objects and strips ETag quotes", async () => {
    const s3 = fakeS3([
      [{ Key: "a.html", ETag: '"aaa"' }],
      [{ Key: "b.html", ETag: '"bbb"' }],
    ])
    const listed = await lambda.s3Bucket(s3, "blog.gcardona.me").list()
    assert.deepEqual([...listed], [["a.html", "aaa"], ["b.html", "bbb"]])
    assert.equal(s3.calls[1][1].ContinuationToken, "1")
  })

  test("uploads with content type and cache control, and no ACL", async () => {
    const s3 = fakeS3([[]])
    await lambda.s3Bucket(s3, "blog.gcardona.me").put({
      key: "index.html",
      body: Buffer.from("<p>hi</p>"),
      contentType: "text/html; charset=utf-8",
      cacheControl: "public, max-age=0, must-revalidate",
    })
    const [, params] = s3.calls[0]
    assert.equal(params.Bucket, "blog.gcardona.me")
    assert.equal(params.Key, "index.html")
    assert.equal(params.ContentType, "text/html; charset=utf-8")
    assert.equal(params.CacheControl, "public, max-age=0, must-revalidate")
    // The bucket is fronted by CloudFront; setting an ACL breaks uploads.
    assert.ok(!("ACL" in params))
  })

  test("deletes in batches of at most 1000 and reports failures", async () => {
    const s3 = fakeS3([[]])
    const keys = Array.from({ length: 1500 }, (_, i) => `k${i}`)
    await lambda.s3Bucket(s3, "b").remove(keys)
    const batches = s3.calls.filter(c => c[0] === "deleteObjects").map(c => c[1].Delete.Objects.length)
    assert.deepEqual(batches, [1000, 500])

    s3.deleteObjects = async () => ({ Errors: [{ Key: "k1", Code: "AccessDenied", Message: "no" }] })
    await assert.rejects(lambda.s3Bucket(s3, "b").remove(["k1"]), /AccessDenied/)
  })
})

test.describe("Craft settings from SSM", () => {
  const ssm = value => ({
    async getParameter(params) {
      assert.equal(params.WithDecryption, true)
      return { Parameter: { Value: value } }
    },
  })

  test("reads the JSON settings", async () => {
    const settings = await lambda.loadCraftSettings(
      ssm('{"apiUrl":"https://example.test/api/v1","folderId":"f"}'),
      "/blog/craft-settings"
    )
    assert.equal(settings.folderId, "f")
  })

  test("explains how to fix incomplete settings", async () => {
    await assert.rejects(
      lambda.loadCraftSettings(ssm("{}"), "/blog/craft-settings"),
      /needs "apiUrl" and "folderId".*npm run craft:configure/
    )
  })

  test("explains how to create the parameter when it doesn't exist", async () => {
    const missing = {
      async getParameter() {
        throw Object.assign(new Error("not found"), { name: "ParameterNotFound" })
      },
    }
    await assert.rejects(
      lambda.loadCraftSettings(missing, "/blog/craft-settings"),
      /\/blog\/craft-settings doesn't exist yet; create it with `npm run craft:configure`/
    )
  })
})
