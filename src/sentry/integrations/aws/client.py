from __future__ import annotations

import logging
import re
from typing import Any, TypedDict

import orjson
from urllib3.exceptions import HTTPError

from sentry import options
from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_autofix_default_connection_pool,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError

logger = logging.getLogger(__name__)

# Regions hosting the managed AWS MCP server, not the regions it can query.
AWS_MCP_REGIONS = (
    "us-east-1",
    "us-west-2",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-northeast-1",
    "eu-central-1",
    "eu-west-1",
    "eu-west-2",
)
AWS_ROLE_ARN_RE = re.compile(
    r"arn:aws:iam::[0-9]{12}:role/(?:[A-Za-z0-9_+=,.@-]+/)*[A-Za-z0-9_+=,.@-]{1,64}"
)
# Seer's workload role may assume only roles under this IAM path (see the role policy
# in getsentry/ops). Other roles that trust Sentry's AWS account, such as the AWS Lambda
# integration's SentryRole, are outside it and so are unreachable from Seer.
AWS_CUSTOMER_ROLE_PATH = "/sentry-seer/"
AWS_ROLE_ARN_MESSAGE = (
    f"Enter the ARN of an AWS IAM role created under the {AWS_CUSTOMER_ROLE_PATH} path."
)
AWS_ROLE_ACCESS_MESSAGE = (
    "Could not assume the AWS role. Check the role ARN and trust policy, then try again."
)
AWS_EXTERNAL_ID_MESSAGE = (
    "The AWS role must require the Sentry external ID in its trust policy. "
    "Update the trust policy and try again."
)
AWS_VERIFICATION_MESSAGE = (
    "Could not verify AWS telemetry access. Check the role permissions and try again."
)
AWS_NOT_CONFIGURED_MESSAGE = "AWS for Seer is not configured. Contact support to enable it."
# The browser holds this request open against the cell-silo verify-connection
# endpoint; verification never runs inside an inter-silo RPC (see README).
AWS_VERIFY_CONNECTION_TIMEOUT = 90

# Verification statuses stored in the org integration config.
AWS_STATUS_UNVERIFIED = "unverified"
AWS_STATUS_CONNECTED = "connected"
AWS_STATUS_ERROR = "error"

# Keep in sync with Seer's fixed runtime session policy in mcp/aws_credentials.py.
SEER_TELEMETRY_ACTIONS = [
    "cloudwatch:DescribeAlarms",
    "cloudwatch:GetMetricData",
    "cloudwatch:GetMetricStatistics",
    "cloudwatch:ListMetrics",
    "logs:DescribeLogGroups",
    "logs:DescribeLogStreams",
    "logs:FilterLogEvents",
    "logs:GetLogEvents",
    "logs:GetQueryResults",
    "logs:StartQuery",
    "logs:StopQuery",
    "xray:BatchGetTraces",
    "xray:GetServiceGraph",
    "xray:GetTraceSummaries",
    "ec2:DescribeInstances",
    "ec2:DescribeInstanceStatus",
    "ecs:DescribeClusters",
    "ecs:DescribeServices",
    "ecs:DescribeTasks",
    "ecs:ListClusters",
    "ecs:ListServices",
    "ecs:ListTasks",
]


def _parse_iam_role_arn(value: Any) -> str:
    if not isinstance(value, str) or len(value.strip()) > 2048:
        raise IntegrationConfigurationError(AWS_ROLE_ARN_MESSAGE)
    value = value.strip()
    if not AWS_ROLE_ARN_RE.fullmatch(value):
        raise IntegrationConfigurationError(AWS_ROLE_ARN_MESSAGE)
    return value


def parse_role_arn(value: Any) -> str:
    """Validate a customer role ARN, which must sit under `AWS_CUSTOMER_ROLE_PATH`."""
    value = _parse_iam_role_arn(value)
    if not value.split(":role", 1)[1].startswith(AWS_CUSTOMER_ROLE_PATH):
        raise IntegrationConfigurationError(AWS_ROLE_ARN_MESSAGE)
    return value


def get_sentry_principal_arn() -> str:
    principal_arn = options.get("aws-seer.principal-arn")
    if not principal_arn:
        raise IntegrationConfigurationError(AWS_NOT_CONFIGURED_MESSAGE)
    return _parse_iam_role_arn(principal_arn)


def get_mcp_url(region: str) -> str:
    if region not in AWS_MCP_REGIONS:
        raise IntegrationConfigurationError("Select a supported AWS MCP region.")
    return f"https://aws-mcp.{region}.api.aws/mcp"


def build_cloudformation_template(principal_arn: str, external_id: str) -> dict[str, Any]:
    """Provision a customer-owned machine identity without creating access keys."""
    return {
        "AWSTemplateFormatVersion": "2010-09-09",
        "Description": "Read infrastructure telemetry for Sentry Seer investigations",
        "Resources": {
            "SeerRole": {
                "Type": "AWS::IAM::Role",
                "Properties": {
                    "Path": AWS_CUSTOMER_ROLE_PATH,
                    "MaxSessionDuration": 3600,
                    "AssumeRolePolicyDocument": {
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Effect": "Allow",
                                "Principal": {"AWS": principal_arn},
                                "Action": "sts:AssumeRole",
                                "Condition": {"StringEquals": {"sts:ExternalId": external_id}},
                            }
                        ],
                    },
                    "Policies": [
                        {
                            "PolicyName": "SeerTelemetry",
                            "PolicyDocument": {
                                "Version": "2012-10-17",
                                "Statement": [
                                    {
                                        "Effect": "Allow",
                                        "Action": SEER_TELEMETRY_ACTIONS,
                                        "Resource": "*",
                                    }
                                ],
                            },
                        }
                    ],
                },
            }
        },
        "Outputs": {"RoleArn": {"Value": {"Fn::GetAtt": ["SeerRole", "Arn"]}}},
    }


class AwsVerifyConnectionResult(TypedDict):
    connection_status: str  # AWS_STATUS_CONNECTED or AWS_STATUS_ERROR
    # A fixed, user-facing message from this module; never Seer's text.
    error_detail: str | None


def verify_aws_connection(
    role_arn: str, external_id: str, region: str
) -> AwsVerifyConnectionResult:
    """Verify trust and telemetry through Seer's runtime identity and signed MCP transport.

    Cell silo only: it calls this cell's Seer, and `aws-seer.principal-arn` holds this
    cell's value. The control silo never verifies; the setup pipeline records the
    result the frontend obtained from the cell-silo verify-connection endpoint.

    Raises `IntegrationConfigurationError` when this cell's workload identity is not
    configured and `IntegrationError` when Seer cannot be reached; a reachable Seer
    produces a result, which may carry a fixed user-facing error.
    """
    role_arn = parse_role_arn(role_arn)
    get_mcp_url(region)
    principal_arn = get_sentry_principal_arn()
    try:
        response = make_signed_seer_api_request(
            seer_autofix_default_connection_pool,
            "/v1/monitoring-providers/aws/verify-connection",
            body=orjson.dumps(
                {
                    "role_arn": role_arn,
                    "external_id": external_id,
                    "region": region,
                    "principal_arn": principal_arn,
                }
            ),
            timeout=AWS_VERIFY_CONNECTION_TIMEOUT,
            # Verification is slow and not idempotent on Seer's side; never retry it.
            retries=0,
        )
    except HTTPError:
        logger.exception("aws.verify_connection_request_error")
        raise IntegrationError(AWS_VERIFICATION_MESSAGE) from None
    if response.status != 200:
        logger.error("aws.verify_connection_failed", extra={"status_code": response.status})
        raise IntegrationError(AWS_VERIFICATION_MESSAGE)
    try:
        result = orjson.loads(response.data)
    except orjson.JSONDecodeError:
        logger.error("aws.verify_connection_invalid_response")
        raise IntegrationError(AWS_VERIFICATION_MESSAGE) from None
    if not isinstance(result, dict):
        logger.error("aws.verify_connection_invalid_response")
        raise IntegrationError(AWS_VERIFICATION_MESSAGE)
    if result.get("connection_status") == AWS_STATUS_CONNECTED:
        return {"connection_status": AWS_STATUS_CONNECTED, "error_detail": None}
    error_detail = {
        "external_id_not_enforced": AWS_EXTERNAL_ID_MESSAGE,
        "role_access_denied": AWS_ROLE_ACCESS_MESSAGE,
    }.get(str(result.get("error_code")), AWS_VERIFICATION_MESSAGE)
    return {"connection_status": AWS_STATUS_ERROR, "error_detail": error_detail}
