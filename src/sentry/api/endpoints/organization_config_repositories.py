from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.plugins import bindings


class OrganizationConfigRepositoriesEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        provider_bindings = bindings.get('repository.provider')

        providers = []
        for provider_id in provider_bindings:
            provider = provider_bindings.get(provider_id)(id=provider_id)
            providers.append({
                'id': provider_id,
                'name': provider.name,
                'config': provider.get_config(),
            })

        return Response({
            'providers': providers,
        })
