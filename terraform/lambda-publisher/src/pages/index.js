import React from "react"
import { css } from "@emotion/react"
import { rhythm } from "../utils/typography"
import Layout from "../components/layout"

export default ({ posts }) => {
  return (
    <Layout>
      <div>
        <h1
          css={css`
            display: inline-block;
            border-bottom: 1px solid;
          `}
        >
          Assorted Findings and Musings
        </h1>
        <h4>{posts.length} Posts</h4>
        {posts.map(post => (
          <div key={post.id}>
            <a
              href={post.slug}
              css={css`
                text-decoration: none;
                color: inherit;
              `}
            >
              <h3
                css={css`
                  margin-bottom: ${rhythm(1 / 4)};
                `}
              >
                {post.title}{" "}
                <span
                  css={css`
                    color: #bbb;
                  `}
                >
                  — {post.displayDate}
                </span>
              </h3>
              <p>{post.excerpt}</p>
            </a>
          </div>
        ))}
      </div>
    </Layout>
  )
}
