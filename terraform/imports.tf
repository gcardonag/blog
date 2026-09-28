# Adopts the resources created under the old Terraform 0.12 / AWS provider
# 2.x state into a fresh state, instead of upgrading that state. IDs are taken
# from the old state.
#
# Once an apply has imported them, these blocks do nothing and this file can
# be deleted.
#
# aws_acm_certificate_validation.cert has no AWS object to import; Terraform
# "creates" it by waiting for the (already issued) certificate.

import {
    to = aws_s3_bucket_public_access_block.content
    id = "blog.gcardona.me"
}

import {
    to = aws_s3_bucket_policy.content
    id = "blog.gcardona.me"
}

import {
    to = aws_cloudfront_distribution.cdn
    id = "E3FDDC0KXS3DHN"
}

import {
    to = aws_route53_record.cdn
    id = "ZHGGQVUFDJJ2Z_blog.gcardona.me_A"
}

import {
    to = aws_acm_certificate.cert
    id = "arn:aws:acm:us-east-1:<aws-account-id>:certificate/defe2856-38c3-487c-9c04-b038451880a5"
}

# The certificate's DNS validation records, keyed by the domain they validate
# (see aws_route53_record.cert_validation in prereqs.tf).
import {
    to = aws_route53_record.cert_validation["blog.gcardona.me"]
    id = "ZHGGQVUFDJJ2Z__a8dad5bbf8396179989d62884e750e5a.blog.gcardona.me_CNAME"
}

import {
    to = aws_route53_record.cert_validation["www.blog.gcardona.me"]
    id = "ZHGGQVUFDJJ2Z__5d2f59ee712672e02cacdb7de54294e7.www.blog.gcardona.me_CNAME"
}
