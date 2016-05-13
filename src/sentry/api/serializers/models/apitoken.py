from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import ApiToken


@register(ApiToken)
class ApiTokenSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'token': obj.token,
            'scopes': [k for k, v in obj.scopes.iteritems() if v],
            'dateCreated': obj.date_added,
        }
