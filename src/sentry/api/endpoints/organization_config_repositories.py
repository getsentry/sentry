from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.plugins import bindings


class OrganizationConfigRepositoriesEndpoint(OrganizationEndpoint):

    def get(self, request, organization):
        provider_bindings = bindings.get('repository.provider')
        has_github_apps = features.has('organizations:github-apps',
                                       organization,
                                       actor=request.user)

        providers = []
        for provider_id in provider_bindings:
            provider = provider_bindings.get(provider_id)(id=provider_id)
            # TODO(jess): figure out better way to exclude this
            if provider_id == 'github_apps':
                continue
            if has_github_apps and provider_id == 'github':
                continue
            providers.append(
                {
                    'id': provider_id,
                    'name': provider.name,
                    'config': provider.get_config(),
                }
            )

        return Response({
            'providers': providers,
        })
