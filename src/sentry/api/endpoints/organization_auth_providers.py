from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationAuthProviderPermission, OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.auth import manager


class OrganizationAuthProvidersEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAuthProviderPermission,)

    def get(self, request, organization):
        """
        List available auth providers that are available to use for an Organization
        ```````````````````````````````````````````````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        provider_list = []
        for k, v in manager:
            provider_list.append({"key": k, "name": v.name, "requiredFeature": v.required_feature})

        return Response(serialize(provider_list, request.user))
