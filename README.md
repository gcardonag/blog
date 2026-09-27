# blog

A static blog whose posts are written in [Craft](https://www.craft.do/) and
pulled in at build time through the
[Craft API](https://connect.craft.do/api-docs/space). Pages are React
components rendered to static HTML, styled with Emotion and typography.js
(Kirkham theme). No client-side JavaScript is shipped except mermaid.js, and
only on posts that contain a diagram.

## Writing posts in Craft
Each document in the blog's Craft folder is one post. Metadata at the very
top of the document acts as front matter and is left out of the page. It can
be one line per block:

```
date: 2020-04-04
tags: azure, active directory, iam, aws
slug: my-post
```

or, as the markdown import produced, a single block of bold labels followed
by a divider (the divider is dropped too):

```
**Title:** Connecting Azure AD and AWS IAM
**Tags:** azure, active directory, iam, aws
**Source file:** 2020-04-04.md
───────────────
```

- `title` defaults to the document's title.
- `date` defaults to the document's title if that is a date (e.g. a document
  named `2020-04-04`), otherwise to its creation date.
- `slug` defaults to the date, so the post is served at `/2020-04-04/`. Two
  posts on the same day need a `slug` line, or the build fails.
- `source file` is accepted and ignored.
- A line break inside a block is rendered as a line break, as Craft shows it.
- Headings, bulleted/numbered/task/toggle lists (including nested ones),
  callouts, captions, code, images, dividers, links and cards are rendered.
  Drawings, whiteboards and collections are skipped with a build warning.
- Diagrams: a code block with the `mermaid` language, or any code block that
  starts with a mermaid keyword (`sequenceDiagram`, `graph`, `flowchart`,
  ...), is drawn as a mermaid diagram.

`my-blog/test/fixtures/craft/` has the original posts in Craft's JSON format,
plus a formatting reference post that uses every supported block type.

## Configuration
The build reads its Craft connection from the environment:

| Variable | Value |
| --- | --- |
| `CRAFT_API_URL` | The URL of an API connection created in Craft's Imagine tab, e.g. `https://connect.craft.do/links/<secret>/api/v1`. The URL itself grants access, so keep it secret. |
| `CRAFT_API_KEY` | Optional. Only needed if the connection has an API key. |
| `CRAFT_FOLDER_ID` | ID of the Craft folder holding the posts (`GET /folders` lists them). |

In CI these are the repository secrets of the same names. The site title,
URL and S3 bucket are set in `my-blog/site.config.js`.

## Dev Environment
Requires Node 20 and Yarn 1. Put the Craft settings in `my-blog/.env` (it is
git-ignored):

```
CRAFT_API_URL=https://connect.craft.do/links/<secret>/api/v1
CRAFT_API_KEY=<if the connection has one>
CRAFT_FOLDER_ID=<folder id>
```

then:

```
cd my-blog/
yarn install
set -a; . ./.env; set +a
yarn develop     # builds from Craft into public/ and serves it on :9000
```

## Tests
```
cd my-blog/
yarn test        # builds against fixture data, then verifies the output
yarn test:only   # re-runs the checks against an existing fixture build
```

`yarn test` needs no Craft credentials. It starts a local stand-in for the
Craft API (`my-blog/test/fake-craft.js`) that serves the fixtures, builds the
site against it through the real API client, and checks the pages in
`public/`: post generation and URLs, the rendering of each block type,
mermaid diagrams, Emotion's CSS extraction, typography, and the deploy
settings. It uses the built-in `node:test` runner and adds no dependencies.
CI runs it on every push and pull request.

## Publishing
The site is rebuilt from Craft and uploaded to S3 by the **Publish Content**
workflow (`.github/workflows/publish-content.yaml`), which runs:

- **hourly**, at 17 minutes past the hour, so new and edited posts go live
  within about an hour. Change the `cron` line to adjust the schedule.
- **on demand**, from the Actions tab (Publish Content → Run workflow), to
  publish immediately.
- **on every push to `main`**, called from the Deploy Site workflow, so code
  changes go out immediately too.

Each run checks the build pipeline against the fixtures (`yarn test`), pulls
the current posts from Craft (`yarn build`), and mirrors `public/` into the
bucket with `aws s3 sync --delete` (`yarn deploy`). Runs are serialised so two
deploys never overlap. The build fails, and nothing is uploaded, if Craft
can't be reached or the folder has no posts, so a bad fetch can't empty the
site.

GitHub disables scheduled workflows in public repositories after 60 days
without repository activity; re-enable it from the Actions tab if that
happens.

## Initial Build Steps
- How was blog initialized?
- Set up Terraform
    - Set up the requisite resources
    - Ensure you have an AWS access key/secret combination with the following perms
        - S3 Read/Write (state)
    - Run `docker-compose run terraform init` to validate terraform initializes properly
    - Run `docker-compose run terraform plan` to validate TF can plan properly
- Create a Craft API connection for the posts folder and add the
  `CRAFT_API_URL`, `CRAFT_API_KEY` (if used) and `CRAFT_FOLDER_ID` secrets

## Deploy Flow:
Prereqs:
- IAM Perms
  - Terraform Deploy (S3, CloudFront create)
    - S3 State Bucket
  - Site Deploy (S3 Write)
  - Cache Invalidate

Site Deploy
- Build from Craft
- S3

Terraform Deploy
- CloudFront
- Route 53
- ACM

## Future Ideas
Track pricing? (AWS tagging)
Container Scanning
Lightouse Tests
Optimizations
    - https://cloud.google.com/solutions/best-practices-for-building-containers