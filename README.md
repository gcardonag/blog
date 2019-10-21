# blog

Built using https://www.gatsbyjs.org/tutorial/using-a-theme/

Dev Environment:
```
docker-compose run --service-ports dev
cd my-blog/
gatsby develop -H 0.0.0.0
```

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
Optimizations
    - https://cloud.google.com/solutions/best-practices-for-building-containers