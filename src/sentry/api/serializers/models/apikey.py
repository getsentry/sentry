from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import ApiKey


@register(ApiKey)
class ApiKeySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "label": obj.label,
            "key": obj.key,
            "scope_list": obj.scope_list,
            "status": obj.status,
            "allowed_origins": ""
            if obj.allowed_origins is None
            else six.text_type(obj.allowed_origins),
        }
