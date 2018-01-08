from __future__ import absolute_import

from rest_framework.response import Response

from sentry import integrations
from sentry.api.bases.organization import OrganizationEndpoint


class OrganizationConfigIntegrationsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        providers = []
        for provider in integrations.all():
            providers.append(
                {
                    'key': provider.key,
                    'name': provider.name,
                    'config': provider.get_config(),
                    'setupDialog': dict(
                        url='/organizations/{}/integrations/{}/setup/'.format(
                            organization.slug,
                            provider.key,
                        ),
                        **provider.setup_dialog_config
                    )
                }
            )

        return Response({
            'providers': providers,
        })
