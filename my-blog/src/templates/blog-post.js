import React from "react"
import Layout from "../components/layout"
import { css } from "@emotion/react"
import { Blocks } from "../craft/blocks"

export default ({ post }) => {
  return (
    <Layout>
      <div>
        <h1>{post.title}</h1>
        <span
            css={css`
            color: #bbb;
            `}
        >
            {post.displayDate}
        </span><br/>
        Tags: {post.tags.map(tag => (
            <span
                key={tag}
                css={css`
                color: #bbb;
                `}
            >
                {tag}&nbsp;
            </span>
        ))}<br/><br/>
        <div>
          <Blocks blocks={post.blocks} />
        </div>
      </div>
    </Layout>
  )
}
