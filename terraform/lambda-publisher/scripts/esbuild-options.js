/**
 * How the source compiles: JSX in .js files, with Emotion's css prop.
 * Shared by the Lambda package (scripts/package.js) and the local preview
 * build (scripts/build.js).
 */
module.exports = {
  bundle: true,
  platform: "node",
  format: "cjs",
  loader: { ".js": "jsx" },
  jsx: "automatic",
  jsxImportSource: "@emotion/react",
  logLevel: "warning",
}
