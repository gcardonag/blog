data "aws_s3_bucket" "content" {
    bucket = "blog.gcardona.me"
}

resource "aws_s3_bucket_public_access_block" "content" {
    bucket = "${data.aws_s3_bucket.content.id}"

    provider = "aws" # https://github.com/terraform-providers/terraform-provider-aws/issues/8560
}

resource "aws_s3_bucket_policy" "content" {
    bucket = "${data.aws_s3_bucket.content.id}"

    policy = <<POLICY
{
  "Version":"2012-10-17",
  "Statement":[{
      "Sid":"PublicReadGetObject",
      "Effect":"Allow",
	  "Principal": "*",
      "Action":["s3:GetObject"],
      "Resource":["arn:aws:s3:::${aws_s3_bucket_public_access_block.content.bucket}/*"
      ]
    }
  ]
}
POLICY
}


locals {
  s3_origin_id = "blogS3Origin"
}

resource "aws_cloudfront_distribution" "cdn" {
    origin {
        domain_name = "${data.aws_s3_bucket.content.website_endpoint}"
        origin_id = "${local.s3_origin_id}"

        custom_origin_config {
            http_port = "80"
            https_port = "443"
            origin_protocol_policy = "http-only"
            origin_ssl_protocols   = ["TLSv1", "TLSv1.1", "TLSv1.2"]
        }
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

        viewer_protocol_policy = "redirect-to-https"
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
        acm_certificate_arn = "${aws_acm_certificate_validation.cert.certificate_arn}"
        ssl_support_method = "sni-only"
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
