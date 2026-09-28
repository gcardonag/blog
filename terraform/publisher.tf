# Publisher: a Lambda that builds the whole site from the latest Craft
# content and syncs it into the content bucket, on a schedule and after each
# deploy. The code is in lambda-publisher/, packaged into lambda-publisher/dist
# by `yarn package` there, which must run before plan/apply.

variable "publish_schedule" {
    description = "How often the publisher rebuilds the site from Craft (EventBridge schedule expression)."
    type        = string
    default     = "rate(1 hour)"
}

locals {
    publisher_name = "blog-publisher"
}

# Craft connection settings as JSON ({ apiUrl, apiKey, folderId }). Terraform
# only creates the parameter; the real value is written out of band with
# `yarn craft:configure` in lambda-publisher/ and never enters Terraform state.
resource "aws_ssm_parameter" "craft_settings" {
    name        = "/blog/craft-settings"
    description = "Craft API connection used by ${local.publisher_name}"
    type        = "SecureString"
    value       = "{}"

    lifecycle {
        ignore_changes = [value]
    }

    tags = {
        Project = "blog"
    }
}

data "archive_file" "publisher" {
    type        = "zip"
    source_dir  = "${path.module}/lambda-publisher/dist"
    output_path = "${path.module}/.build/publisher.zip"
}

resource "aws_cloudwatch_log_group" "publisher" {
    name              = "/aws/lambda/${local.publisher_name}"
    retention_in_days = 30

    tags = {
        Project = "blog"
    }
}

resource "aws_iam_role" "publisher" {
    name = local.publisher_name

    assume_role_policy = jsonencode({
        Version = "2012-10-17"
        Statement = [{
            Effect    = "Allow"
            Principal = { Service = "lambda.amazonaws.com" }
            Action    = "sts:AssumeRole"
        }]
    })

    tags = {
        Project = "blog"
    }
}

resource "aws_iam_role_policy" "publisher" {
    name = local.publisher_name
    role = aws_iam_role.publisher.id

    policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
            {
                Sid      = "WriteLogs"
                Effect   = "Allow"
                Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
                Resource = "${aws_cloudwatch_log_group.publisher.arn}:*"
            },
            {
                Sid      = "ListSite"
                Effect   = "Allow"
                Action   = ["s3:ListBucket"]
                Resource = data.aws_s3_bucket.content.arn
            },
            {
                Sid      = "WriteSite"
                Effect   = "Allow"
                Action   = ["s3:PutObject", "s3:DeleteObject"]
                Resource = "${data.aws_s3_bucket.content.arn}/*"
            },
            {
                # SecureString with the AWS managed key: no kms:Decrypt grant
                # is needed, the key policy allows use through SSM.
                Sid      = "ReadCraftSettings"
                Effect   = "Allow"
                Action   = ["ssm:GetParameter"]
                Resource = aws_ssm_parameter.craft_settings.arn
            },
        ]
    })
}

resource "aws_lambda_function" "publisher" {
    function_name    = local.publisher_name
    description      = "Rebuilds the blog from Craft and syncs it into ${data.aws_s3_bucket.content.id}"
    role             = aws_iam_role.publisher.arn
    runtime          = "nodejs22.x" # keep in step with lambda-publisher/.nvmrc
    architectures    = ["arm64"]
    handler          = "index.handler"
    filename         = data.archive_file.publisher.output_path
    source_code_hash = data.archive_file.publisher.output_base64sha256
    memory_size      = 512
    timeout          = 120

    environment {
        variables = {
            BUCKET_NAME              = data.aws_s3_bucket.content.id
            CRAFT_SETTINGS_PARAMETER = aws_ssm_parameter.craft_settings.name
        }
    }

    depends_on = [aws_cloudwatch_log_group.publisher, aws_iam_role_policy.publisher]

    tags = {
        Project = "blog"
    }
}

# A scheduled run that fails (e.g. Craft unreachable) is retried once; the
# next scheduled run tries again anyway.
resource "aws_lambda_function_event_invoke_config" "publisher" {
    function_name                = aws_lambda_function.publisher.function_name
    maximum_retry_attempts       = 1
    maximum_event_age_in_seconds = 3600
}

resource "aws_cloudwatch_event_rule" "publish" {
    name                = local.publisher_name
    description         = "Rebuild the blog from Craft"
    schedule_expression = var.publish_schedule

    tags = {
        Project = "blog"
    }
}

resource "aws_cloudwatch_event_target" "publish" {
    rule = aws_cloudwatch_event_rule.publish.name
    arn  = aws_lambda_function.publisher.arn
}

resource "aws_lambda_permission" "publish_schedule" {
    statement_id  = "AllowScheduledPublish"
    action        = "lambda:InvokeFunction"
    function_name = aws_lambda_function.publisher.function_name
    principal     = "events.amazonaws.com"
    source_arn    = aws_cloudwatch_event_rule.publish.arn
}

output "publisher_function_name" {
    value = aws_lambda_function.publisher.function_name
}
