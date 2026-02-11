from __future__ import annotations

from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry import quotas
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import UserAuthTokenAuthentication
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.constants import DataCategory
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization, RpcUserOrganizationContext
from sentry.preprod.authentication import LaunchpadRpcSignatureAuthentication


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


@region_silo_endpoint
class OrganizationPreprodRetentionEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (
        LaunchpadRpcSignatureAuthentication,
        SessionAuthentication,
        UserAuthTokenAuthentication,
    )
    permission_classes = (LaunchpadServiceOrOrganizationPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        size_retention = (
            quotas.backend.get_event_retention(
                organization=organization, category=DataCategory.SIZE_ANALYSIS
            )
            or 90
        )
        build_distribution_retention = (
            quotas.backend.get_event_retention(
                organization=organization, category=DataCategory.INSTALLABLE_BUILD
            )
            or 90
        )
        return Response(
            {
                "size": size_retention,
                "buildDistribution": build_distribution_retention,
                "snapshots": 396,  # hardcoded for now
            }
        )
