from __future__ import absolute_import

from rest_framework.response import Response

from sentry import integrations
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize, IntegrationProviderSerializer

from sentry import features
from django.conf import settings


class OrganizationConfigIntegrationsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        has_catchall = features.has('organizations:internal-catchall',
                                    organization,
                                    actor=request.user)
        has_github_apps = features.has('organizations:github-apps',
                                       organization,
                                       actor=request.user)

        providers = []
        for provider in integrations.all():
            internal_integrations = {
                i for i in settings.SENTRY_INTERNAL_INTEGRATIONS if i != 'github' or not has_github_apps}
            if not has_catchall and provider.key in internal_integrations:
                continue

            providers.append(provider)

        providers.sort(key=lambda i: i.key)

        serialized = serialize(
            providers,
            organization=organization,
            serializer=IntegrationProviderSerializer(),
        )

        return Response({'providers': serialized})
