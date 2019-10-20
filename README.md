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
- Set up initial Docker image
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
- Terraform
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
- Container Sizes