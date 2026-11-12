from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import ViewerContextAuthentication
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.auth.principal import acting_user_id, require_user
from sentry.models.organization import Organization
from sentry.seer.agent.monitoring_providers import (
    get_monitoring_provider_connections,
    refresh_monitoring_provider_identity_token,
    refresh_monitoring_provider_integration_token,
)
from sentry.seer.sentry_data_models import (
    MonitoringProviderConnectionsResponse,
    RefreshMonitoringProviderTokenErrorResponse,
    RefreshMonitoringProviderTokenSuccessResponse,
)

_REFRESH_ERROR_STATUS = {
    "identity_not_found": 404,
    "integration_not_found": 404,
    "identity_not_valid": 400,
    "refresh_not_supported": 400,
    "refresh_failed": 502,
    "encryption_failed": 500,
}


class SeerMonitoringProviderPermission(OrganizationPermission):
    # These hand out (Seer-encrypted) credentials for the org's monitoring integrations, so
    # they need the scope that runs Seer, not just read access.
    scope_map = {
        "GET": ["seer:write"],
        "POST": ["seer:write"],
    }


class SeerMonitoringProviderEndpoint(OrganizationEndpoint):
    """
    Base for the endpoints that give Seer monitoring provider (MCP) credentials.

    Only a signed ``X-Viewer-Context`` authenticates, so the caller is always the user or
    service account that a Seer run acts for, and its org access and scopes apply.
    """

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    authentication_classes = (ViewerContextAuthentication,)
    permission_classes = (SeerMonitoringProviderPermission,)


def _refresh_response(
    result: RefreshMonitoringProviderTokenSuccessResponse
    | RefreshMonitoringProviderTokenErrorResponse,
) -> Response:
    if isinstance(result, RefreshMonitoringProviderTokenErrorResponse):
        return Response({"detail": result.error}, status=_REFRESH_ERROR_STATUS[result.error])
    return Response(result.dict())


@cell_silo_endpoint
class OrganizationSeerMonitoringConnectionsEndpoint(SeerMonitoringProviderEndpoint):
    def get(self, request: Request, organization: Organization) -> Response:
        """
        The caller's monitoring provider connections: its own identities, then the org's
        integrations. A service account has no identities, so it gets the org's only.
        """
        connections = get_monitoring_provider_connections(
            organization, acting_user_id(request.user)
        )
        return Response(MonitoringProviderConnectionsResponse(connections=connections).dict())


@cell_silo_endpoint
class OrganizationSeerMonitoringIdentityTokenEndpoint(SeerMonitoringProviderEndpoint):
    def post(self, request: Request, organization: Organization, identity_id: str) -> Response:
        """Refresh the access token of one of the caller's monitoring provider identities."""
        if not features.has("organizations:seer-infra-telemetry", organization) or not features.has(
            "organizations:seer-infra-telemetry-user-level-auth", organization
        ):
            raise ResourceDoesNotExist
        return _refresh_response(
            refresh_monitoring_provider_identity_token(
                int(identity_id),
                organization_id=organization.id,
                user_id=require_user(request).id,
            )
        )


@cell_silo_endpoint
class OrganizationSeerMonitoringIntegrationTokenEndpoint(SeerMonitoringProviderEndpoint):
    def post(self, request: Request, organization: Organization, integration_id: str) -> Response:
        """Refresh the access token of one of the org's monitoring integrations."""
        if not features.has("organizations:seer-infra-telemetry", organization):
            raise ResourceDoesNotExist
        return _refresh_response(
            refresh_monitoring_provider_integration_token(
                organization_id=organization.id, integration_id=int(integration_id)
            )
        )
