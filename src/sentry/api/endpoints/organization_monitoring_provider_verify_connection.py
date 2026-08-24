from __future__ import annotations

from rest_framework.fields import CharField, ListField
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.endpoints.organization_monitoring_provider_index import (
    MonitoringProviderPermission,
)
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations.gcp.client import verify_gcp_connection
from sentry.models.organization import Organization
from sentry.shared_integrations.exceptions import IntegrationError


class GcpVerifyConnectionSerializer(CamelSnakeSerializer["GcpVerifyConnectionSerializer"]):
    sentry_sa_email = CharField(required=True)
    customer_sa_email = CharField(required=True)
    gcp_project_ids = ListField(
        child=CharField(max_length=64), required=True, min_length=1, max_length=100
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

        try:
            result = verify_gcp_connection(
                sentry_sa_email=data["sentry_sa_email"],
                customer_sa_email=data["customer_sa_email"],
                gcp_project_ids=data["gcp_project_ids"],
            )
        except IntegrationError as exc:
            return Response({"detail": str(exc)}, status=502)

        return Response(result)
