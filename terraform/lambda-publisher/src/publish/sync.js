/**
 * Mirrors a generated site into a bucket: uploads new and changed files,
 * then deletes objects the site no longer has.
 *
 * `bucket` is a small interface so this can run against S3 (./s3.js) or an
 * in-memory stand-in in tests:
 *   list()          -> Map of key -> MD5 hex of the stored object
 *   put(file)       -> stores { key, body, contentType, cacheControl }
 *   remove(keys)    -> deletes the given keys
 */
import crypto from "crypto"

// HTML is revalidated on every request so new posts show up without a
// CloudFront invalidation.
export const CACHE_CONTROL = "public, max-age=0, must-revalidate"

export async function syncToBucket(files, bucket) {
  // Deleting everything the new site lacks would take the live site down if
  // generation ever produced nothing, so refuse outright.
  if (!files.some(f => f.key === "index.html")) {
    throw new Error("Refusing to publish a site without index.html")
  }

  const existing = await bucket.list()

  // Upload pages before the index that links to them, so a visitor never
  // follows a new link to a page that isn't there yet.
  const ordered = [...files].sort((a, b) => (a.key === "index.html") - (b.key === "index.html"))

  // Only content is compared: a file whose bytes are unchanged is skipped
  // even if CACHE_CONTROL or its content type has since changed.
  let uploaded = 0
  for (const file of ordered) {
    const md5 = crypto.createHash("md5").update(file.body).digest("hex")
    if (existing.get(file.key) === md5) continue
    await bucket.put({ ...file, cacheControl: CACHE_CONTROL })
    uploaded++
  }

  const keep = new Set(files.map(f => f.key))
  const stale = [...existing.keys()].filter(key => !keep.has(key))
  if (stale.length > 0) await bucket.remove(stale)

  return { uploaded, unchanged: files.length - uploaded, deleted: stale.length }
}
