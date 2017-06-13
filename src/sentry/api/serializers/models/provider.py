from __future__ import absolute_import

from sentry.api.serializers import Serializer
from sentry.models import Installation, OrganizationInstallation


class ProviderSerializer(Serializer):
    def __init__(self, organization):
        self.organization = organization

    def serialize(self, obj, attrs, user):
        user_installations = obj.get_installations(user)
        installations = list(Installation.objects.filter(
            installation_id__in=[i['installation_id'] for i in user_installations],
        ))

        linked_installations = set(OrganizationInstallation.objects.filter(
            organization=self.organization,
        ).values_list('installation_id', flat=True))

        installations = [{
            'installationId': i.installation_id,
            'externalOrganization': i.external_organization,
            'linked': i.id in linked_installations,
        } for i in installations]

        return {
            'id': obj.id,
            'name': obj.name,
            'installUrl': obj.get_install_url(),
            'installations': installations,
        }
