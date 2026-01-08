from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint


class SynapseAuthPermission(BasePermission):
    """
    Requires the X-Synapse-Auth header to be set to the SYNAPSE_AUTH_SECRET.
    """

    def has_permission(self, request: Request, view: object) -> bool:
        if settings.IS_DEV:
            return True

        if not settings.SYNAPSE_AUTH_SECRET:
            return False

        return request.META.get("HTTP_X_SYNAPSE_AUTH") == settings.SYNAPSE_AUTH_SECRET


@control_silo_endpoint
class OrgCellMappingsEndpoint(Endpoint):
    """
    Returns the organization-to-cell mappings for all orgs in pages.
    Only accessible by the Synapse internal service via X-Synapse-Auth header.
    """

    owner = ApiOwner.INFRA_ENG
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SynapseAuthPermission,)

    def get(self, request: Request) -> Response:
        """
        Retrieve organization-to-cell mappings.
        """
        # TODO: Implement GET logic
        return Response({"mappings": []}, status=200)
