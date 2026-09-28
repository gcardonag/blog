import React from "react"
import { css } from "@emotion/react"

import { title } from "../../site.config"
import { rhythm } from "../utils/typography"

export default ({ children }) => {
  return (
    <div
      css={css`
        margin: 0 auto;
        max-width: 700px;
        padding: ${rhythm(2)};
        padding-top: ${rhythm(1.5)};
      `}
    >
      <a href={`/`}>
        <h3
          css={css`
            margin-bottom: ${rhythm(2)};
            display: inline-block;
            font-style: normal;
          `}
        >
          {title}
        </h3>
      </a>
      <a
        href={`/about/`}
        css={css`
          float: right;
        `}
      >
        About
      </a>
      {children}
    </div>
  )
}
