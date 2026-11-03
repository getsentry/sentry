from __future__ import annotations

import logging
from collections.abc import Sequence

import orjson
from pydantic import BaseModel, StrictBool, ValidationError
from urllib3.exceptions import HTTPError

from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_autofix_default_connection_pool,
)
from sentry.shared_integrations.exceptions import IntegrationError

logger = logging.getLogger(__name__)


class AwsServiceVerification(BaseModel):
    service: str
    status: str
    error_detail: str | None = None


class AwsRegionVerification(BaseModel):
    region: str
    connection_status: str
    services: list[AwsServiceVerification]
    error_detail: str | None = None


class AwsVerification(BaseModel):
    connection_status: str
    # True only after AssumeRole succeeds with the external ID AND fails with
    # AccessDenied without it. Missing/ambiguous results must fail closed.
    external_id_required: StrictBool
    regions: list[AwsRegionVerification]
    error_detail: str | None = None

    @property
    def can_connect(self) -> bool:
        return self.external_id_required and any(
            region.connection_status == "connected" for region in self.regions
        )


def verify_aws_connection(
    *, organization_id: int, role_arn: str, external_id: str, regions: Sequence[str]
) -> AwsVerification:
    """Verify via Seer, which owns the GCP -> AWS broker authentication chain."""
    try:
        response = make_signed_seer_api_request(
            seer_autofix_default_connection_pool,
            "/v1/monitoring-providers/aws/verify-connection",
            body=orjson.dumps(
                {
                    "organization_id": organization_id,
                    "role_arn": role_arn,
                    "external_id": external_id,
                    "regions": list(regions),
                }
            ),
            timeout=60,
        )
    except HTTPError as exc:
        logger.exception("aws.verify_connection_request_error")
        raise IntegrationError("Could not verify the AWS connection. Try again.") from exc

    if response.status != 200:
        logger.error("aws.verify_connection_failed", extra={"status_code": response.status})
        raise IntegrationError("Could not verify the AWS connection. Try again.")

    try:
        result = AwsVerification.parse_raw(response.data)
        returned_regions = [region.region for region in result.regions]
        if len(returned_regions) != len(regions) or set(returned_regions) != set(regions):
            raise ValueError("Verification regions do not match the requested regions")
    except (ValidationError, ValueError) as exc:
        logger.exception("aws.verify_connection_invalid_response")
        raise IntegrationError("Could not verify the AWS connection. Try again.") from exc

    return result
