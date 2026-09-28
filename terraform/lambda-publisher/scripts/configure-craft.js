/**
 * Creates or updates the SSM SecureString parameter the publisher Lambda
 * reads its Craft connection settings from. Terraform only refers to this
 * parameter (see ../publisher.tf), so that its value never enters state.
 *
 *   set -a; . ./.env; set +a
 *   npm run craft:configure
 *
 * Takes CRAFT_API_URL, CRAFT_API_KEY (optional) and CRAFT_FOLDER_ID from the
 * environment and writes them with the AWS CLI, using the current AWS
 * credentials. The value goes through a short-lived file readable only by
 * you, so the secret URL never appears in the process list or shell history.
 * (The CLI can't read --cli-input-json from a piped /dev/stdin on macOS.)
 */
const { execFileSync } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")

const PARAMETER = process.env.CRAFT_SETTINGS_PARAMETER || "/blog/craft-settings"
const REGION = "us-east-1"

const settings = {
  apiUrl: process.env.CRAFT_API_URL,
  apiKey: process.env.CRAFT_API_KEY || undefined,
  folderId: process.env.CRAFT_FOLDER_ID,
}
if (!settings.apiUrl || !settings.folderId) {
  console.error("Set CRAFT_API_URL and CRAFT_FOLDER_ID (e.g. `set -a; . ./.env; set +a`) first.")
  process.exit(1)
}

const input = JSON.stringify({
  Name: PARAMETER,
  Type: "SecureString",
  Overwrite: true,
  Value: JSON.stringify(settings),
})

// mkdtemp creates a new directory only this user can enter (0700), and the
// file inside is 0600; both are removed whether or not the CLI succeeds.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "craft-configure-"))
const inputFile = path.join(dir, "put-parameter.json")
try {
  fs.writeFileSync(inputFile, input, { mode: 0o600 })
  execFileSync(
    "aws",
    ["ssm", "put-parameter", "--region", REGION, "--cli-input-json", `file://${inputFile}`],
    { stdio: ["ignore", "ignore", "inherit"] }
  )
} catch (err) {
  // The CLI has already printed why it failed.
  process.exitCode = err.status || 1
} finally {
  fs.rmSync(dir, { recursive: true, force: true })
}
if (!process.exitCode) console.log(`Stored the Craft settings in ${PARAMETER}.`)
