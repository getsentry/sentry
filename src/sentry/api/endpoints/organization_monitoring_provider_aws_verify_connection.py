from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.serializers.rest_framework.base import (
    convert_dict_key_case,
    snake_to_camel_case,
)
from sentry.integrations.aws.client import (
    AWS_NOT_CONFIGURED_MESSAGE,
    AWS_VERIFICATION_MESSAGE,
    AwsVerifyConnectionResult,
    verify_aws_connection,
)
from sentry.integrations.aws.serializers import AwsRoleInput, AwsRoleSerializer
from sentry.integrations.aws.verification import verification_fields, verification_signer
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError

logger = logging.getLogger(__name__)


class AwsVerifyConnectionSerializer(AwsRoleSerializer):
    """Keep the endpoint's parameter-key-case metric separate from the setup pipeline's."""


def _record_verification_result(
    organization: Organization,
    verified: AwsRoleInput,
    external_id: str,
    result: AwsVerifyConnectionResult,
) -> None:
    active = integration_service.organization_context(
        organization_id=organization.id, provider=IntegrationProviderSlug.AWS.value
    ).active()
    if active is None:
        # First-time setup verifies before the integration exists; the pipeline
        # records that result through its verification step instead.
        return

    # Only record a result that describes what is currently stored, so a stale caller
    # cannot overwrite the status with results for settings that have since changed.
    _, org_integration = active
    config = org_integration.config or {}
    verified_config = {**verified, "external_id": external_id}
    if any(config.get(key) != value for key, value in verified_config.items()):
        return

    integration_service.update_organization_integration(
        org_integration_id=org_integration.id,
        expected_config=config,
        config={**config, **verification_fields(result)},
    )


@cell_silo_endpoint
class OrganizationMonitoringProviderAwsVerifyConnectionEndpoint(OrganizationEndpoint):
    """Verify the customer role through this cell's Seer.

    The organization's Seer and its AWS workload identity live in the organization's
    cell, which org-scoped URLs are routed to, so verification must happen here --
    never in the control silo, which hosts setup and settings.
    """

    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    permission_classes = (OrganizationIntegrationsPermission,)

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
            _record_verification_result(organization, data, external_id, result)
        except Exception:
            logger.exception(
                "aws.verify_connection_record_failed",
                extra={"organization_id": organization.id},
            )
            return Response(
                {"detail": "Could not save the AWS verification result. Try again."}, status=503
            )

        receipt = verification_signer(
            organization_id=organization.id, external_id=external_id, **data
        ).sign_object(result)
        # Unlike GCP, AWS is not a connect_telemetry provider yet, so there are no
        # open investigation connect requests to apply here.
        return Response(
            convert_dict_key_case(
                {**result, **data, "verification_receipt": receipt},
                snake_to_camel_case,
            )
        )
