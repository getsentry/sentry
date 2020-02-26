from __future__ import absolute_import

from rest_framework.response import Response

from sentry import integrations
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize, IntegrationProviderSerializer


class OrganizationConfigIntegrationsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):

        providers = list(integrations.all())

        providers.sort(key=lambda i: i.key)

        serialized = serialize(
            providers, organization=organization, serializer=IntegrationProviderSerializer()
        )

        if "provider_key" in request.GET:
            serialized = [d for d in serialized if d["key"] == request.GET["provider_key"]]

        if not serialized:
            return Response({"detail": "Providers do not exist"}, status=404)

        return Response({"providers": serialized})
