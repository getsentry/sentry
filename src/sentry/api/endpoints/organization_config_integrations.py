from __future__ import absolute_import

from rest_framework.response import Response

from sentry import integrations
from sentry.api.bases.organization import OrganizationEndpoint

from sentry import features
from django.conf import settings


class OrganizationConfigIntegrationsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        providers = []
        has_catchall = features.has('organizations:internal-catchall',
                                    organization,
                                    actor=request.user)

        for provider in integrations.all():
            metadata = provider.metadata
            metadata = metadata and metadata._asdict() or None
            if not has_catchall and provider.key in settings.SENTRY_INTERNAL_INTEGRATIONS:
                continue
            providers.append(
                {
                    'key': provider.key,
                    'name': provider.name,
                    'metadata': metadata,
                    'canAdd': provider.can_add,
                    'canAddProject': provider.can_add_project,
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
