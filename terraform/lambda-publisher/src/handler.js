/**
 * Lambda entry point: builds the whole site from the latest Craft content
 * (./site.js) and syncs it into the site's S3 bucket. Invoked on a schedule
 * by EventBridge (see ../../publisher.tf), and once after each deploy.
 *
 * Environment:
 *   BUCKET_NAME                the site bucket
 *   CRAFT_SETTINGS_PARAMETER   SSM SecureString holding the Craft settings
 */
import path from "path"

import { generateSite } from "./site"
import { syncToBucket } from "./publish/sync"
import { s3Bucket, loadCraftSettings } from "./publish/aws"

// Exposed so tests can check the AWS adapters in the packaged bundle.
export { s3Bucket, loadCraftSettings }

/** The publishing steps, with their dependencies passed in (used by tests). */
export async function publish({ settings, bucket, staticDir }) {
  const { files, posts } = await generateSite({ craft: settings, staticDir })
  const result = await syncToBucket(files, bucket)
  const summary = { posts: posts.length, files: files.length, ...result }
  console.log(JSON.stringify({ message: "Published site", ...summary }))
  return summary
}

export async function handler() {
  // The AWS SDK comes with the Lambda runtime, so it isn't bundled; loading
  // it here keeps it out of the tests' way too.
  const { S3 } = await import("@aws-sdk/client-s3")
  const { SSM } = await import("@aws-sdk/client-ssm")

  const settings = await loadCraftSettings(new SSM({}), requireEnv("CRAFT_SETTINGS_PARAMETER"))
  return publish({
    settings,
    bucket: s3Bucket(new S3({}), requireEnv("BUCKET_NAME")),
    staticDir: path.join(__dirname, "static"),
  })
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}
