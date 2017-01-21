from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import ApiToken


@register(ApiToken)
class ApiTokenSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'token': obj.token,
            'scopes': [k for k, v in six.iteritems(obj.scopes) if v],
            'dateCreated': obj.date_added,
        }
