/**
 * Stores the Craft connection settings where the publisher Lambda reads them:
 * an SSM SecureString parameter created by ../publisher.tf.
 *
 *   set -a; . ./.env; set +a
 *   yarn craft:configure
 *
 * Takes CRAFT_API_URL, CRAFT_API_KEY (optional) and CRAFT_FOLDER_ID from the
 * environment and writes them with the AWS CLI, using the current AWS
 * credentials. The value is passed on stdin, so the secret URL never appears
 * in the process list or shell history.
 */
const { execFileSync } = require("child_process")

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

execFileSync("aws", ["ssm", "put-parameter", "--region", REGION, "--cli-input-json", "file:///dev/stdin"], {
  input,
  stdio: ["pipe", "ignore", "inherit"],
})
console.log(`Stored the Craft settings in ${PARAMETER}.`)
