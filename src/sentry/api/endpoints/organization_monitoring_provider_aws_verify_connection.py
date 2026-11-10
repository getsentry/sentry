from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, TypedDict

from django.utils import timezone
from rest_framework.fields import CharField, ChoiceField
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import ValidationError

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.endpoints.organization_monitoring_provider_index import (
    MonitoringProviderPermission,
)
from sentry.api.serializers.rest_framework.base import (
    CamelSnakeSerializer,
    convert_dict_key_case,
    snake_to_camel_case,
)
from sentry.constants import ObjectStatus
from sentry.integrations.aws.client import (
    AWS_MCP_REGIONS,
    AWS_NOT_CONFIGURED_MESSAGE,
    AWS_ROLE_ARN_MESSAGE,
    AWS_VERIFICATION_MESSAGE,
    AwsVerifyConnectionResult,
    parse_role_arn,
    verify_aws_connection,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError

logger = logging.getLogger(__name__)


class AwsVerifyConnectionInput(TypedDict):
    role_arn: str
    region: str


class AwsVerifyConnectionSerializer(CamelSnakeSerializer[AwsVerifyConnectionInput]):
    role_arn = CharField(required=True, max_length=2048)
    region = ChoiceField(choices=[(region, region) for region in AWS_MCP_REGIONS], required=True)

    def validate_role_arn(self, value: str) -> str:
        try:
            return parse_role_arn(value)
        except IntegrationConfigurationError:
            # Respond with a fixed message so no exception text reaches the client.
            raise ValidationError(AWS_ROLE_ARN_MESSAGE) from None


def _record_verification_result(
    organization: Organization,
    verified: Mapping[str, Any],
    result: AwsVerifyConnectionResult,
) -> None:
    ctx = integration_service.organization_context(
        organization_id=organization.id,
        provider=IntegrationProviderSlug.AWS.value,
    )
    integration = ctx.integration
    org_integration = ctx.organization_integration
    if (
        integration is None
        or org_integration is None
        or integration.status != ObjectStatus.ACTIVE
        or org_integration.status != ObjectStatus.ACTIVE
    ):
        # First-time setup verifies before the integration exists; the pipeline
        # records that result through its verification step instead.
        return

    # Only record a result that describes what is currently stored, so a stale caller
    # cannot overwrite the status with results for settings that have since changed.
    config = org_integration.config or {}
    if config.get("role_arn") != verified["role_arn"]:
        return
    if config.get("region") != verified["region"]:
        return

    integration_service.update_organization_integration(
        org_integration_id=org_integration.id,
        config={
            **config,
            "connection_status": result["connection_status"],
            "error_detail": result["error_detail"],
            "last_verified_at": timezone.now().isoformat(),
        },
    )


@cell_silo_endpoint
class OrganizationMonitoringProviderAwsVerifyConnectionEndpoint(OrganizationEndpoint):
    """Verify the customer role through this cell's Seer.

    The organization's Seer and its AWS workload identity live in the organization's
    cell, which org-scoped URLs are routed to, so verification must happen here --
    never in the control silo, which hosts setup and settings.
    """

    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (MonitoringProviderPermission,)

    def post(self, request: Request, organization: Organization, **kwargs: object) -> Response:
        if not features.has("organizations:integrations-aws", organization, actor=request.user):
            return Response(status=404)

        serializer = AwsVerifyConnectionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        # The server-generated trust identifier is persisted before setup returns a
        # CloudFormation template; it is never accepted from the request.
        external_id = organization.get_option("aws-seer.external-id")
        if not external_id:
            return Response(
                {"detail": "No Sentry external ID configured for this organization."},
                status=404,
            )

        try:
            result = verify_aws_connection(data["role_arn"], external_id, data["region"])
        except IntegrationConfigurationError:
            # This cell's Seer workload identity is not configured. Respond with a
            # fixed message so no exception text reaches the client.
            logger.warning(
                "aws.verify_connection_not_configured",
                extra={"organization_id": organization.id},
            )
            return Response({"detail": AWS_NOT_CONFIGURED_MESSAGE}, status=404)
        except IntegrationError:
            # verify_aws_connection already logs the underlying failure.
            return Response({"detail": AWS_VERIFICATION_MESSAGE}, status=502)

        try:
            _record_verification_result(organization, data, result)
        except Exception:
            logger.exception(
                "aws.verify_connection_record_failed",
                extra={"organization_id": organization.id},
            )

        # Unlike GCP, AWS is not a connect_telemetry provider yet, so there are no
        # open investigation connect requests to apply here.
        return Response(
            convert_dict_key_case(
                {**result, "role_arn": data["role_arn"], "region": data["region"]},
                snake_to_camel_case,
            )
        )
