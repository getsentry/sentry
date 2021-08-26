from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationAuthProviderPermission, OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import AuthProvider


class OrganizationAuthProviderDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAuthProviderPermission,)

    def get(self, request, organization):
        """
        Retrieve details about Organization's SSO settings and
        currently installed auth_provider
        ``````````````````````````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        try:
            auth_provider = AuthProvider.objects.get(organization=organization)
        except AuthProvider.DoesNotExist:
            # This is a valid state where org does not have an auth provider
            # configured, make sure we respond with a 20x
            return Response(status=status.HTTP_204_NO_CONTENT)

        # cache organization so that we don't need to query for org when serializing
        auth_provider.set_cached_field_value("organization", organization)

        return Response(serialize(auth_provider, request.user))
