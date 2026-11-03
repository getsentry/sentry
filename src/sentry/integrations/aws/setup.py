from __future__ import annotations

from typing import Any

import orjson


def trust_policy(principal_arn: str, external_id: str) -> dict[str, Any]:
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"AWS": principal_arn},
                "Action": ["sts:AssumeRole", "sts:SetSourceIdentity"],
                "Condition": {"StringEquals": {"sts:ExternalId": external_id}},
            }
        ],
    }


PERMISSION_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cloudwatch:DescribeAlarms",
                "cloudwatch:DescribeAlarmHistory",
                "cloudwatch:GetMetricData",
                "cloudwatch:ListMetrics",
                "logs:DescribeLogGroups",
                "logs:DescribeQueryDefinitions",
                "logs:StartQuery",
                "logs:GetQueryResults",
                "logs:StopQuery",
                "logs:FilterLogEvents",
                "logs:GetLogEvents",
                "logs:ListLogAnomalyDetectors",
                "logs:ListAnomalies",
                "xray:Get*",
                "xray:List*",
                "xray:BatchGet*",
            ],
            "Resource": "*",
        },
        {
            "Effect": "Allow",
            "Action": "signin:CreateOAuth2Token",
            "Resource": "arn:aws:signin:*:*:service-principal/aws-mcp.amazonaws.com",
            "Condition": {"StringEquals": {"signin:OAuthGrantType": "client_credentials"}},
        },
    ],
}


def terraform_config(principal_arn: str, external_id: str) -> str:
    trust = orjson.dumps(
        trust_policy(principal_arn, external_id), option=orjson.OPT_INDENT_2
    ).decode()
    permissions = orjson.dumps(PERMISSION_POLICY, option=orjson.OPT_INDENT_2).decode()
    return f"""resource "aws_iam_role" "sentry_seer" {{
  name                 = "SentrySeerAccess"
  max_session_duration = 3600
  assume_role_policy   = <<-POLICY
{trust}
POLICY
}}

resource "aws_iam_role_policy" "sentry_seer" {{
  name   = "SentrySeerTelemetry"
  role   = aws_iam_role.sentry_seer.id
  policy = <<-POLICY
{permissions}
POLICY
}}

output "role_arn" {{
  value = aws_iam_role.sentry_seer.arn
}}
"""
