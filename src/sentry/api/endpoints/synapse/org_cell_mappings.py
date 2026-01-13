from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.endpoints.synapse.authentication import (
    SynapseAuthPermission,
    SynapseSignatureAuthentication,
)


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
    authentication_classes = (SynapseSignatureAuthentication,)
    permission_classes = (SynapseAuthPermission,)

    def get(self, request: Request) -> Response:
        """
        Retrieve organization-to-cell mappings.
        """
        # TODO: Implement GET logic
        return Response({"mappings": []}, status=200)
