resource "aws_acm_certificate" "cert" {
    domain_name = "blog.gcardona.me"
    subject_alternative_names = ["www.blog.gcardona.me"]
    validation_method = "DNS"

    lifecycle {
        create_before_destroy = true
    }
}

data "aws_route53_zone" "zone" {
    name = "gcardona.me."
    private_zone = false
}

resource "aws_route53_record" "cert_validation" {
    # One record per name on the certificate. domain_validation_options is a
    # set (not a list) from AWS provider 3.x on, so it is keyed by domain.
    for_each = {
        for dvo in aws_acm_certificate.cert.domain_validation_options : dvo.domain_name => dvo
    }

    allow_overwrite = true

    name    = each.value.resource_record_name
    type    = each.value.resource_record_type
    zone_id = data.aws_route53_zone.zone.id
    records = [each.value.resource_record_value]
    ttl     = 60
}

# The two records used to be separate resources; keep them rather than
# recreating them under their new addresses.
# moved {
#     from = aws_route53_record.cert_validation
#     to   = aws_route53_record.cert_validation["blog.gcardona.me"]
# }

# moved {
#     from = aws_route53_record.cert_validation_alt1
#     to   = aws_route53_record.cert_validation["www.blog.gcardona.me"]
# }

resource "aws_acm_certificate_validation" "cert" {
  certificate_arn         = aws_acm_certificate.cert.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}
