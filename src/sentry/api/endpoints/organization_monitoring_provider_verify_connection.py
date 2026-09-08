from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from django.utils import timezone
from rest_framework.fields import CharField, ListField
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer

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
from sentry.integrations.gcp.client import verify_gcp_connection
from sentry.integrations.gcp.utils import resolve_project_error_detail
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.shared_integrations.exceptions import IntegrationError

logger = logging.getLogger(__name__)


class GcpVerifyConnectionSerializer(CamelSnakeSerializer["GcpVerifyConnectionSerializer"]):
    customer_sa_email = CharField(required=True)
    gcp_project_ids = ListField(
        child=CharField(max_length=64), required=True, min_length=1, max_length=100
    )


class GcpVerifyConnectionServiceResultSerializer(Serializer[dict[str, object]]):
    service = CharField()
    status = CharField()
    error_detail = CharField(required=False, allow_null=True)


class GcpVerifyConnectionProjectResultSerializer(Serializer[dict[str, object]]):
    gcp_project_id = CharField()
    connection_status = CharField()
    services = GcpVerifyConnectionServiceResultSerializer(many=True)
    error_detail = CharField(required=False, allow_null=True)


class GcpVerifyConnectionResponseSerializer(Serializer[dict[str, object]]):
    connection_status = CharField()
    projects = GcpVerifyConnectionProjectResultSerializer(many=True)
    error_detail = CharField(required=False, allow_null=True)


def _record_verification_result(
    organization: Organization,
    verified: dict[str, Any],
    result: Mapping[str, Any],
) -> None:
    ctx = integration_service.organization_context(
        organization_id=organization.id,
        provider=IntegrationProviderSlug.GCP.value,
    )
    integration = ctx.integration
    org_integration = ctx.organization_integration
    if (
        integration is None
        or org_integration is None
        or integration.status != ObjectStatus.ACTIVE
        or org_integration.status != ObjectStatus.ACTIVE
    ):
        return

    # Only record a result that describes what is currently stored, so a stale caller
    # cannot overwrite the status with results for settings that have since changed.
    config = org_integration.config or {}
    if config.get("customer_sa_email") != verified["customer_sa_email"]:
        return
    if set(config.get("projects", [])) != set(verified["gcp_project_ids"]):
        return

    integration_service.update_organization_integration(
        org_integration_id=org_integration.id,
        config={
            **config,
            "connection_status": result["connection_status"],
            "project_statuses": [
                {
                    "gcp_project_id": project["gcp_project_id"],
                    "connection_status": project["connection_status"],
                    "error_detail": project.get("error_detail"),
                }
                for project in result["projects"]
            ],
            "last_verified_at": timezone.now().isoformat(),
        },
    )


@cell_silo_endpoint
class OrganizationMonitoringProviderVerifyConnectionEndpoint(OrganizationEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (MonitoringProviderPermission,)

    def post(self, request: Request, organization: Organization, **kwargs: object) -> Response:
        if not features.has("organizations:seer-infra-telemetry", organization, actor=request.user):
            return Response(status=404)

        serializer = GcpVerifyConnectionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        sentry_sa_email = integration_service.get_gcp_service_account_email(
            organization_id=organization.id,
        )
        if sentry_sa_email is None:
            return Response(
                {"detail": "No GCP service account configured for this organization."},
                status=404,
            )

        try:
            result = verify_gcp_connection(
                sentry_sa_email=sentry_sa_email,
                customer_sa_email=data["customer_sa_email"],
                gcp_project_ids=data["gcp_project_ids"],
            )
        except IntegrationError as exc:
            return Response({"detail": str(exc)}, status=502)

        response_serializer = GcpVerifyConnectionResponseSerializer(data=result)
        if not response_serializer.is_valid():
            return Response(
                {"detail": "Failed to verify GCP connection. Please try again."},
                status=502,
            )

        verified_result = response_serializer.validated_data
        for project in verified_result["projects"]:
            project["error_detail"] = resolve_project_error_detail(project)

        try:
            _record_verification_result(organization, data, verified_result)
        except Exception:
            logger.exception(
                "gcp.verify_connection_record_failed",
                extra={"organization_id": organization.id},
            )

        return Response(convert_dict_key_case(verified_result, snake_to_camel_case))
