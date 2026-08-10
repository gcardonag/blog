# blog

Built using https://www.gatsbyjs.org/tutorial/using-a-theme/

Dev Environment:
```
docker compose run --service-ports dev
cd my-blog/
gatsby develop -H 0.0.0.0
```

## Tests
```
cd my-blog/
yarn test        # builds the site, then verifies the generated output
yarn test:only   # re-runs the checks against an existing public/ build
```

The suite in `my-blog/test/` asserts against the built site in `public/`, so it
covers the whole pipeline: markdown sourcing, the remark transform, mermaid
diagrams, Emotion's CSS extraction, typography, React SSR, and the S3 deploy
configuration. It is written with the built-in `node:test` runner and pulls in
no dependencies of its own. CI runs it on every push and pull request, and the
deploy job ships the same build the tests verified.

## Dependency Security
Transitive dependencies whose parents pin them below a published security fix
are forced up via `resolutions` in `my-blog/package.json`; see the
`comment:resolutions` field there for the exceptions and why they stand.
Re-check with `cd my-blog/ && yarn audit`.

## Initial Build Steps
- How was blog initialized?
- Set up Terraform
    - Set up the requisite resources
    - Ensure you have an AWS access key/secret combination with the following perms
        - S3 Read/Write (state)
    - Run `docker-compose run terraform init` to validate terraform initializes properly
    - Run `docker-compose run terraform plan` to validate TF can plan properly
- Set up initial Docker image locally (so that you can pull/push for future updates without pull errors)
    - docker login
    - docker build -t tag/name .
    - docker push tag/name

## Deploy Flow:
Prereqs:
- IAM Perms
  - Terraform Deploy (S3, CloudFront create)
    - S3 State Bucket
  - Gatsby Deploy (S3 Write)
  - Cache Invalidate

Build Docker Containers
- Gatsby

Gatsby Deploy
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