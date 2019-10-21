data "aws_s3_bucket" "content" {
    bucket = "blog.gcardona.me"
}

resource "aws_s3_bucket_public_access_block" "content" {
    bucket = "${data.aws_s3_bucket.content.id}"

    provider = "aws" # https://github.com/terraform-providers/terraform-provider-aws/issues/8560
}

locals {
  s3_origin_id = "blogS3Origin"
}

resource "aws_cloudfront_distribution" "cdn" {
    origin {
        domain_name = "${data.aws_s3_bucket.content.bucket_regional_domain_name}"
        origin_id = "${local.s3_origin_id}"
    }

    price_class = "PriceClass_100"

    enabled = true
    is_ipv6_enabled = true
    default_root_object = "index.html"

    aliases = ["blog.gcardona.me", "www.blog.gcardona.me"]

    default_cache_behavior {
        allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
        cached_methods   = ["GET", "HEAD"]
        target_origin_id = "${local.s3_origin_id}"

        forwarded_values {
            query_string = false

            cookies {
                forward = "none"
            }
        }

        viewer_protocol_policy = "allow-all"
        min_ttl                = 3600
        default_ttl            = 3600
        max_ttl                = 86400
    }

    restrictions {
        geo_restriction {
            restriction_type = "none"
        }
    }

    viewer_certificate {
        acm_certificate_arn = "${aws_acm_certificate.cert.arn}"
    }

    tags = {
        Project = "blog"
    }
}

resource "aws_route53_record" "cdn" {
    zone_id = "${data.aws_route53_zone.zone.id}"
    name = "blog.gcardona.me"
    type = "A"

    alias {
        name = "${aws_cloudfront_distribution.cdn.domain_name}"
        zone_id = "${aws_cloudfront_distribution.cdn.hosted_zone_id}"
        evaluate_target_health = false
    }
}
