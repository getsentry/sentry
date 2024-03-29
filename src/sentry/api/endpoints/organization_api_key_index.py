from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import (
    ControlSiloOrganizationEndpoint,
    OrganizationAdminPermission,
)
from sentry.api.serializers import serialize
from sentry.models.apikey import ApiKey

DEFAULT_SCOPES = ["project:read", "event:read", "team:read", "org:read", "member:read"]


@control_silo_endpoint
class OrganizationApiKeyIndexEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationAdminPermission,)

    def get(self, request: Request, organization_context, organization) -> Response:
        """
        List an Organization's API Keys
        ```````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        queryset = sorted(
            ApiKey.objects.filter(organization_id=organization.id), key=lambda x: x.label
        )

        return Response(serialize(queryset, request.user))
