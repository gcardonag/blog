/**
 * Uploads public/ to the site's S3 bucket (formerly gatsby-plugin-s3).
 *
 * Uses the AWS CLI with credentials from the environment. Objects are uploaded
 * without an ACL because the bucket is only read through CloudFront. HTML is
 * revalidated on every request so new posts show up without an invalidation.
 */
const { execFileSync } = require("child_process")
const path = require("path")
const { s3 } = require("../site.config")

const publicDir = path.resolve(__dirname, "..", "public")

execFileSync(
  "aws",
  [
    "s3", "sync", publicDir, `s3://${s3.bucketName}`,
    "--region", s3.region,
    "--delete",
    "--cache-control", "public, max-age=0, must-revalidate",
  ],
  { stdio: "inherit" }
)
