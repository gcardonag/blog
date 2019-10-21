import React from "react"
import { graphql } from "gatsby"
import Layout from "../components/layout"
import { css } from "@emotion/core"

export default ({ data }) => {
  const post = data.markdownRemark
  return (
    <Layout>
      <div>
        <h1>{post.frontmatter.title}</h1>
        <span
            css={css`
            color: #bbb;
            `}
        >
            {post.frontmatter.date}
        </span><br/>
        Tags: {post.frontmatter.tags.map(tag => (
            <span
                css={css`
                color: #bbb;
                `}
            >
                {tag}&nbsp;
            </span>
        ))}<br/><br/>
        <div dangerouslySetInnerHTML={{ __html: post.html }} />
      </div>
    </Layout>
  )
}

export const query = graphql`
  query($slug: String!) {
    markdownRemark(fields: { slug: { eq: $slug } }) {
      html
      frontmatter {
        title
        date(formatString: "DD MMMM, YYYY")
        tags
      }
    }
  }
`