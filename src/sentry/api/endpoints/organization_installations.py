from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.plugins import bindings
from sentry.models import Installation, OrganizationInstallation


class OrganizationInstallationEndpoint(OrganizationEndpoint):

    def get(self, request, organization):
        results = []
        for provider_id, provider_cls in bindings.get('repository.provider').all():
            provider = provider_cls(id=provider_id)
            user_installations = provider.get_installations(request.user)
            installations = list(Installation.objects.filter(
                installation_id__in=[i['installation_id'] for i in user_installations],
            ))

            # this should go in a serializer
            linked_installations = set(OrganizationInstallation.objects.filter(
                organization=organization,
            ).values_list('installation_id', flat=True))

            installations = [{
                'installation_id': i.installation_id,
                'linked': i.id in linked_installations,
            } for i in installations]

            results.append({
                'id': provider_id,
                'name': provider.name,
                'installations': installations,
            })

        return Response(results)
