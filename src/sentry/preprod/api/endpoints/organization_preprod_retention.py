from __future__ import annotations

from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import OrgAuthTokenAuthentication, UserAuthTokenAuthentication
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.constants import DataCategory
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization, RpcUserOrganizationContext
from sentry.preprod.authentication import LaunchpadRpcSignatureAuthentication
from sentry.preprod.retention import get_retention_days_or_default


class LaunchpadServiceOrOrganizationPermission(OrganizationPermission):
    def _is_launchpad_auth(self, request: Request) -> bool:
        return bool(
            request.auth
            and hasattr(request, "successful_authenticator")
            and isinstance(request.successful_authenticator, LaunchpadRpcSignatureAuthentication)
        )

    def has_permission(self, request: Request, view: APIView) -> bool:
        if self._is_launchpad_auth(request):
            return True
        return super().has_permission(request, view)

    def has_object_permission(
        self,
        request: Request,
        view: APIView,
        organization: Organization | RpcOrganization | RpcUserOrganizationContext,
    ) -> bool:
        if self._is_launchpad_auth(request):
            return True
        return super().has_object_permission(request, view, organization)


@cell_silo_endpoint
class OrganizationPreprodRetentionEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (
        LaunchpadRpcSignatureAuthentication,
        UserAuthTokenAuthentication,
        OrgAuthTokenAuthentication,
        SessionAuthentication,
    )
    permission_classes = (LaunchpadServiceOrOrganizationPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        return Response(
            {
                "size": get_retention_days_or_default(organization, DataCategory.SIZE_ANALYSIS),
                "buildDistribution": get_retention_days_or_default(
                    organization, DataCategory.INSTALLABLE_BUILD
                ),
            }
        )
