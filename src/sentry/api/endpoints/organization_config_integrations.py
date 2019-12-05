from __future__ import absolute_import

from rest_framework.response import Response

from sentry import integrations, features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize, IntegrationProviderSerializer


class OrganizationConfigIntegrationsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        has_pagerduty = features.has("organizations:pagerduty-v2", organization, actor=request.user)

        providers = []
        for provider in integrations.all():
            if not has_pagerduty and provider.key == "pagerduty":
                continue

            providers.append(provider)

        providers.sort(key=lambda i: i.key)

        serialized = serialize(
            providers, organization=organization, serializer=IntegrationProviderSerializer()
        )

        return Response({"providers": serialized})
