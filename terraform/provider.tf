provider "aws" {
  version = "~> 2.0"
  region  = "us-east-1"
}

terraform {
    backend "s3" {
        bucket = "gcardona-tf-state"
        key = "blog"
        region = "us-east-1"
    }
}