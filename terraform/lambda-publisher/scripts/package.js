/**
 * `yarn package`: bundles the Lambda (src/handler.js and everything it
 * imports) into dist/, with the static files beside it. ../publisher.tf zips
 * dist/ and deploys it, so this must run before terraform plan/apply.
 *
 * The AWS SDK is left out; the Lambda runtime provides it.
 */
const esbuild = require("esbuild")
const fs = require("fs")
const path = require("path")

const options = require("./esbuild-options")

const ROOT = path.resolve(__dirname, "..")
const OUT_DIR = path.join(ROOT, "dist")

async function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true })
  await esbuild.build({
    ...options,
    absWorkingDir: ROOT,
    entryPoints: ["src/handler.js"],
    outfile: path.join(OUT_DIR, "index.js"),
    target: "node22", // the Lambda runtime; keep in step with .nvmrc
    external: ["@aws-sdk/*"],
  })
  fs.cpSync(path.join(ROOT, "static"), path.join(OUT_DIR, "static"), { recursive: true })
  console.log(`Packaged the Lambda into ${path.relative(process.cwd(), OUT_DIR) || "."}`)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
