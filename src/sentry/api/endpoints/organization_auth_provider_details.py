from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationAuthProviderPermission, OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import AuthProvider


@region_silo_endpoint
class OrganizationAuthProviderDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAuthProviderPermission,)

    def get(self, request: Request, organization) -> Response:
        """
        Retrieve details about Organization's SSO settings and
        currently installed auth_provider
        ``````````````````````````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        try:
            auth_provider = AuthProvider.objects.get(organization_id=organization.id)
        except AuthProvider.DoesNotExist:
            # This is a valid state where org does not have an auth provider
            # configured, make sure we respond with a 20x
            return Response(status=status.HTTP_204_NO_CONTENT)

        return Response(serialize(auth_provider, request.user))
