/**
 * `yarn test`: builds the site against the fixture Craft server, then runs the
 * checks in test/*.test.js over the output in public/.
 */
const { spawn } = require("child_process")
const path = require("path")
const fakeCraft = require("./fake-craft")

const SITE_ROOT = path.resolve(__dirname, "..")

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: SITE_ROOT,
      stdio: "inherit",
      env: { ...process.env, ...env },
    })
    child.on("error", reject)
    child.on("exit", code => resolve(code))
  })
}

async function main() {
  const { server, env } = await fakeCraft.start()
  let code
  try {
    // Run through yarn so the build is exactly what `yarn build` does.
    code = await run("yarn", ["--silent", "build"], env)
  } finally {
    server.close()
  }
  if (code !== 0) {
    console.error("Build failed; skipping the site checks.")
    process.exit(code)
  }
  process.exit(await run(process.execPath, ["--test", ...testFiles()]))
}

function testFiles() {
  return require("fs")
    .readdirSync(__dirname)
    .filter(f => f.endsWith(".test.js"))
    .map(f => path.join("test", f))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
