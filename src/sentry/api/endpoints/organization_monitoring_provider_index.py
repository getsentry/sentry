from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import (
    ControlSiloOrganizationEndpoint,
    OrganizationPermission,
)
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.users.models.identity import OrganizationIdentity

MONITORING_PROVIDERS: dict[str, dict[str, str]] = {
    "datadog": {"name": "Datadog"},
    "datadog_pat": {"name": "Datadog (Personal Access Token)"},
    "gcp": {"name": "Google Cloud Platform"},
}


class MonitoringProviderPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }


@control_silo_endpoint
class OrganizationMonitoringProviderIndexEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (MonitoringProviderPermission,)

    def get(self, request: Request, organization: RpcOrganization, **kwargs: object) -> Response:
        if not features.has("organizations:seer-infra-telemetry", organization, actor=request.user):
            return Response(status=404)

        connected_providers = set(
            OrganizationIdentity.objects.filter(
                organization_id=organization.id,
                identity__user_id=request.user.id,  # type: ignore[misc]
                identity__idp__type__in=MONITORING_PROVIDERS.keys(),
            ).values_list("identity__idp__type", flat=True)
        )

        providers = []
        for key, meta in MONITORING_PROVIDERS.items():
            providers.append(
                {
                    "provider": key,
                    "name": meta["name"],
                    "connected": key in connected_providers,
                }
            )

        return Response({"providers": providers})
