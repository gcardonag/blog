/**
 * Configure your Gatsby site with this file.
 *
 * See: https://www.gatsbyjs.org/docs/gatsby-config/
 */

const siteAddress = new URL("https://blog.gcardona.me")

module.exports = {
  siteMetadata: {
    title: `Gabe's Blog`,
  },
  plugins: [
    {
      resolve: `gatsby-plugin-s3`,
      options: {
        bucketName: "blog.gcardona.me",
        protocol: siteAddress.protocol.slice(0, -1),
        region: "us-east-1",
        hostname: siteAddress.hostname,
        acl: null,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `posts`,
        path: `${__dirname}/content/posts`,
      },
    },
    `gatsby-transformer-remark`,
    `gatsby-plugin-emotion`,
    {
      resolve: `gatsby-plugin-typography`,
      options: {
        pathToConfigModule: `src/utils/typography`,
      },
    },
  ],
}