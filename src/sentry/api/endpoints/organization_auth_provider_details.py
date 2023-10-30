from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationAuthProviderPermission, OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.auth_provider import AuthProviderSerializer
from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.auth.service import auth_service


@region_silo_endpoint
class OrganizationAuthProviderDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (OrganizationAuthProviderPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Retrieve details about Organization's SSO settings and
        currently installed auth_provider
        ``````````````````````````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        auth_provider = auth_service.get_auth_provider(organization_id=organization.id)
        if not auth_provider:
            # This is a valid state where org does not have an auth provider
            # configured, make sure we respond with a 20x
            return Response(status=status.HTTP_204_NO_CONTENT)

        return Response(
            serialize(
                auth_provider,
                request.user,
                organization=organization,
                serializer=AuthProviderSerializer(),
            )
        )
