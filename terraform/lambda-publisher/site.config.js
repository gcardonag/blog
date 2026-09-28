/**
 * Site-wide settings, shared by the Lambda, the local preview and the tests.
 *
 * For local builds, Craft credentials are read from the environment (see
 * .env in the README) rather than stored here:
 *   CRAFT_API_URL    the API URL from the connection created in Craft's Imagine
 *                    tab, e.g. https://connect.craft.do/links/<secret>/api/v1
 *   CRAFT_API_KEY    optional; only needed if the connection has an API key
 *   CRAFT_FOLDER_ID  the Craft folder whose documents are the blog's posts
 *
 * The Lambda reads the same settings from SSM instead, and gets its bucket
 * from Terraform (../publisher.tf).
 */

const siteAddress = new URL("https://blog.gcardona.me")

module.exports = {
  title: `Gabe's Blog`,
  siteUrl: siteAddress.href,
  craft: {
    apiUrl: process.env.CRAFT_API_URL,
    apiKey: process.env.CRAFT_API_KEY,
    folderId: process.env.CRAFT_FOLDER_ID,
  },
}
