terraform {
    # required_version = ">= 1.5"

    required_providers {
        aws = {
            source  = "hashicorp/aws"
            version = "~> 6.0"
        }
        archive = {
            source  = "hashicorp/archive"
            version = "~> 2.4"
        }
    }

    backend "s3" {
        bucket = "gcardona-tf-state"
        key = "blog"
        region = "us-east-1"
    }
}

provider "aws" {
  region  = "us-east-1"
}
