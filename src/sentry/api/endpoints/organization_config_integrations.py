from __future__ import absolute_import

from rest_framework.response import Response

from sentry import integrations
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize, IntegrationProviderSerializer

from sentry import features


class OrganizationConfigIntegrationsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        has_jira_server = features.has('organizations:jira-server-integration',
                                       organization,
                                       actor=request.user)
        providers = []
        for provider in integrations.all():
            if not has_jira_server and provider.key == 'jira_server':
                continue
            providers.append(provider)

        providers.sort(key=lambda i: i.key)

        serialized = serialize(
            providers,
            organization=organization,
            serializer=IntegrationProviderSerializer(),
        )

        return Response({'providers': serialized})
