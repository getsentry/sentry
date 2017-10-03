from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import AuthProvider


@register(AuthProvider)
class AuthProviderSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'provider': obj.provider,
        }
