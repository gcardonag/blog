# blog

A static blog whose posts are written in [Craft](https://www.craft.do/).
A Lambda function builds the whole site from the latest Craft content (via
the [Craft API](https://connect.craft.do/api-docs/space)) and publishes it to
the S3 bucket behind CloudFront, on a schedule and after every deploy. This
repository holds that Lambda and the Terraform that deploys it and the rest
of the site's infrastructure.

Pages are React components rendered to static HTML, styled with Emotion and
typography.js (Kirkham theme). No client-side JavaScript is shipped except
mermaid.js, and only on posts that contain a diagram.

## Repository layout
```
.github/workflows/deploy-site.yaml   test → package → terraform apply → build and publish
terraform/
  blog.tf, prereqs.tf                CloudFront, bucket policy, DNS, certificate
  publisher.tf                       the Lambda, its schedule, IAM, SSM settings, logs
  imports.tf                         one-time adoption of existing resources (see below)
  lambda-publisher/                  the Lambda's code: the full site build
    src/handler.js                   Lambda entry: fetch from Craft → render → sync to S3
    src/site.js, src/html.js         full-site generation
    src/craft/                       Craft API client, posts, block rendering
    src/components/ pages/ templates/ utils/   the site's React components and styles
    src/publish/                     S3 sync and SSM settings
    src/build.js                     local preview build into public/
    static/                          files published as-is (favicon)
    scripts/                         package (for Terraform), build, serve, craft:configure
    test/                            fake Craft API, fixtures, page and publishing checks
```

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

`terraform/lambda-publisher/test/fixtures/craft/` has the original posts in
Craft's JSON format, plus a formatting reference post that uses every
supported block type.

## Configuration
Both the Lambda and the local preview need the Craft connection:

| Setting | Value |
| --- | --- |
| API URL | The URL of an API connection created in Craft's Imagine tab, e.g. `https://connect.craft.do/links/<secret>/api/v1`. The URL itself grants access, so keep it secret. |
| API key | Optional. Only needed if the connection has an API key. |
| Folder ID | ID of the Craft folder holding the posts (`GET /folders` lists them). |

- **In AWS**, the Lambda reads them from the SSM SecureString parameter
  `/blog/craft-settings`. Terraform creates it with a placeholder and never
  tracks its value; `yarn craft:configure` copies your local settings into it.
- **Locally**, they come from the environment as `CRAFT_API_URL`,
  `CRAFT_API_KEY` and `CRAFT_FOLDER_ID`, kept in
  `terraform/lambda-publisher/.env` (git-ignored):
  ```
  CRAFT_API_URL=https://connect.craft.do/links/<secret>/api/v1
  CRAFT_API_KEY=<if the connection has one>
  CRAFT_FOLDER_ID=<folder id>
  ```

The site title and URL are set in `terraform/lambda-publisher/site.config.js`.

## Local Development
Requires Node 22, matching the Lambda's `nodejs22.x` runtime (`nvm use`
picks it up from `.nvmrc`), and Yarn 1. All commands run in
`terraform/lambda-publisher/`:

```
yarn install
set -a; . ./.env; set +a
yarn preview     # builds from Craft into public/ (as the Lambda would) and serves it on :9000
yarn package     # bundles the Lambda into dist/ for Terraform
yarn test        # builds and packages against fixture data, then verifies both
yarn test:only   # re-runs the checks against an existing fixture build
```

`yarn build` and the Lambda run the same site generator (`src/site.js`); the
preview just writes to `public/` instead of the bucket.

`yarn test` needs no Craft or AWS credentials. It starts a local stand-in for
the Craft API (`test/fake-craft.js`) that serves the fixtures, then:
- builds the site against it and checks the pages in `public/`: post
  generation and URLs, the rendering of each block type, mermaid diagrams,
  Emotion's CSS extraction and typography;
- packages the Lambda and runs the bundle against an in-memory bucket and
  stand-in S3/SSM clients: uploads, skipped unchanged files, deletions, and
  that a failed Craft fetch leaves the bucket untouched.

It uses the built-in `node:test` runner and adds no dependencies. CI runs it
on every push and pull request.

## Publishing
The live site is built and published by the **blog-publisher** Lambda
(`terraform/lambda-publisher/`, deployed by `terraform/publisher.tf`). Each
run pulls the posts from Craft, builds the whole site in memory, and syncs it
into the `blog.gcardona.me` bucket: changed files are uploaded (pages first,
the index last), then objects the site no longer has are deleted. Unchanged
files are skipped.

It runs:

- **hourly**, on an EventBridge schedule. Change the `publish_schedule`
  Terraform variable (e.g. `rate(30 minutes)` or `cron(0 14 ? * MON *)`) to
  adjust it.
- **after every deploy** from `main`, with the code just deployed.
- **on demand**:
  ```
  aws lambda invoke --function-name blog-publisher --region us-east-1 response.json
  ```

If Craft can't be reached, rejects the credentials, or the folder has no
posts, the run fails before touching the bucket, so a bad fetch can't empty
the site. Failed scheduled runs are retried once; logs are in the
`/aws/lambda/blog-publisher` log group (kept 30 days).

CloudFront caches pages for at least an hour (`min_ttl` in
`terraform/blog.tf`), so a newly published post can take up to an hour more
to appear at blog.gcardona.me.

## Initial Build Steps
- How was blog initialized?
- Set up Terraform
    - Set up the requisite resources
    - Ensure you have an AWS access key/secret combination with the following perms
        - S3 Read/Write (state)
    - Run `docker-compose run terraform init` to validate terraform initializes properly
    - Run `docker-compose run terraform plan` to validate TF can plan properly
- Set up the publisher (once). The Lambda needs its Craft settings before it
  first runs, so create the parameter on its own, fill it, then deploy:
    ```
    cd terraform/lambda-publisher && yarn install && yarn package
    cd .. && terraform init
    terraform apply -target=aws_ssm_parameter.craft_settings
    cd lambda-publisher && set -a && . ./.env && set +a && yarn craft:configure
    ```
    Run `yarn craft:configure` again whenever the Craft connection changes.

## Moving to the fresh Terraform state (one time)
The original state was written by Terraform 0.12 with AWS provider 2.x,
which current Terraform can't load. Rather than upgrading it, the config
starts a fresh state in the same `blog` key and adopts the existing
resources with the import blocks in `terraform/imports.tf`.

1. Move the old state aside (keep it, in case you need to look anything up):
    ```
    aws s3 mv s3://gcardona-tf-state/blog s3://gcardona-tf-state/blog-0.12-backup
    ```
2. Start over locally, so init doesn't reuse the old backend settings:
    ```
    cd terraform/lambda-publisher && yarn install && yarn package
    cd .. && rm -rf .terraform
    terraform init
    terraform plan
    ```
    The plan should import 7 resources (bucket policy, public access block,
    CloudFront distribution, the site's DNS record, the certificate and its
    two validation records) and create only the certificate validation step
    and the publisher resources. If it wants to replace or destroy anything,
    stop and find out why before applying.
3. Create and fill the Craft settings parameter, then apply the rest:
    ```
    terraform apply -target=aws_ssm_parameter.craft_settings
    cd lambda-publisher && set -a && . ./.env && set +a && yarn craft:configure
    cd .. && terraform apply
    ```
4. Delete `terraform/imports.tf`; its blocks do nothing once imported.

## Deploy Flow:
Prereqs:
- IAM Perms
  - Terraform Deploy (S3, CloudFront create)
    - S3 State Bucket
  - Publisher (Lambda, IAM role and policy, EventBridge rule, SSM parameter,
    CloudWatch log group; `lambda:InvokeFunction` for the post-deploy run)
  - Cache Invalidate

On push to `main` (`.github/workflows/deploy-site.yaml`):
- Test (fixture build, packaged Lambda)
- Package the Lambda
- Terraform Deploy
    - CloudFront
    - Route 53
    - ACM
    - Publisher Lambda and its schedule
- Build and publish the site (invoke the Lambda)

## Future Ideas
Track pricing? (AWS tagging)
Container Scanning
Lightouse Tests
Optimizations
    - https://cloud.google.com/solutions/best-practices-for-building-containers