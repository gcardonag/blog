/**
 * `npm run build`: bundles src/build.js into .cache/build.cjs with esbuild, then
 * runs it to write the site to public/ for local preview.
 */
const esbuild = require("esbuild")
const { execFileSync } = require("child_process")
const path = require("path")

const options = require("./esbuild-options")

const ROOT = path.resolve(__dirname, "..")
const outfile = path.join(ROOT, ".cache", "build.cjs")

esbuild
  .build({ ...options, absWorkingDir: ROOT, entryPoints: ["src/build.js"], outfile })
  .then(() => execFileSync(process.execPath, [outfile], { stdio: "inherit" }))
  .catch(err => {
    // A failed build.cjs run has already printed its own error.
    if (!err.status) console.error(err.message)
    process.exit(1)
  })
