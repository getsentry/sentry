from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlencode

from boto3.session import Session

from sentry.shared_integrations.exceptions import IntegrationConfigurationError

# The MCP endpoint's region is independent of the regions queried by its tools.
AWS_MCP_URL = "https://aws-mcp.us-east-1.api.aws/mcp"
AWS_REGIONS = tuple(Session().get_available_regions("logs", partition_name="aws"))
AWS_STACK_NAME = "SentrySeerAccess"
AWS_STACK_URL = (
    "https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks"
)
AWS_ROLE_ARN_RE = re.compile(
    r"arn:aws:iam::(?P<account_id>[0-9]{12}):role/"
    r"(?P<path>(?:[\x21-\x7e]+/)?)(?P<name>[\w+=,.@-]{1,64})",
    re.ASCII,
)


def parse_role_arn(value: Any) -> str:
    arn = value.strip() if isinstance(value, str) else ""
    match = AWS_ROLE_ARN_RE.fullmatch(arn)
    if not match or len(match["path"]) > 511:
        raise IntegrationConfigurationError(
            "Enter an IAM role ARN in the form arn:aws:iam::123456789012:role/SentrySeerAccess."
        )
    return arn


def parse_regions(value: Any) -> list[str]:
    if not isinstance(value, (list, tuple)) or not value:
        raise IntegrationConfigurationError("Select at least one AWS region.")
    if any(not isinstance(region, str) or region.strip() not in AWS_REGIONS for region in value):
        raise IntegrationConfigurationError("Select supported AWS regions in the aws partition.")
    return list(dict.fromkeys(region.strip() for region in value))


def cloudformation_url(template_url: str, principal_arn: str, external_id: str) -> str:
    query = urlencode(
        {
            "templateURL": template_url,
            "stackName": AWS_STACK_NAME,
            "param_SentryPrincipalArn": principal_arn,
            "param_ExternalId": external_id,
        }
    )
    return f"{AWS_STACK_URL}/create/review?{query}"
