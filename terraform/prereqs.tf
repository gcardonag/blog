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
    allow_overwrite = true

    name    = "${aws_acm_certificate.cert.domain_validation_options.0.resource_record_name}"
    type    = "${aws_acm_certificate.cert.domain_validation_options.0.resource_record_type}"
    zone_id = "${data.aws_route53_zone.zone.id}"
    records = ["${aws_acm_certificate.cert.domain_validation_options.0.resource_record_value}"]
    ttl     = 60
}

resource "aws_route53_record" "cert_validation_alt1" {
    allow_overwrite = true

  name    = "${aws_acm_certificate.cert.domain_validation_options.1.resource_record_name}"
  type    = "${aws_acm_certificate.cert.domain_validation_options.1.resource_record_type}"
  zone_id = "${data.aws_route53_zone.zone.id}"
  records = ["${aws_acm_certificate.cert.domain_validation_options.1.resource_record_value}"]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "cert" {
  certificate_arn         = "${aws_acm_certificate.cert.arn}"
  validation_record_fqdns = [
      "${aws_route53_record.cert_validation.fqdn}",
      "${aws_route53_record.cert_validation_alt1.fqdn}"
      ]
}
