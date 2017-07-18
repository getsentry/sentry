from __future__ import absolute_import

from sentry.api.serializers import Serializer


class ProviderSerializer(Serializer):
    def __init__(self, organization):
        self.organization = organization

    def serialize(self, obj, attrs, user):
        return {
            'id': obj.id,
            'name': obj.name,
            'availableAuth': [{
                'externalId': a['external_id'],
                'defaultAuthId': a['default_auth_id'],
                'type': a['type'],
            } for a in obj.get_available_auth(user, self.organization)],
            'existingAuth': [{
                'externalId': a['external_id'],
                'defaultAuthId': a['default_auth_id'],
                'type': a['type'],
            } for a in obj.get_existing_auth(self.organization)],
        }
