/**
 * Site-wide settings, shared by the build, the deploy script and the tests.
 *
 * Craft credentials are read from the environment rather than stored here:
 *   CRAFT_API_URL    the API URL from the connection created in Craft's Imagine
 *                    tab, e.g. https://connect.craft.do/links/<secret>/api/v1
 *   CRAFT_API_KEY    optional; only needed if the connection has an API key
 *   CRAFT_FOLDER_ID  the Craft folder whose documents are the blog's posts
 */

const siteAddress = new URL("https://blog.gcardona.me")

module.exports = {
  title: `Gabe's Blog`,
  siteUrl: siteAddress.href,
  s3: {
    bucketName: siteAddress.hostname,
    region: "us-east-1",
  },
  craft: {
    apiUrl: process.env.CRAFT_API_URL,
    apiKey: process.env.CRAFT_API_KEY,
    folderId: process.env.CRAFT_FOLDER_ID,
  },
}
