from __future__ import absolute_import

import six
from sentry.api.serializers import Serializer


class RoleSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        allowed_roles = kwargs.get("allowed_roles") or []

        return {
            "id": six.text_type(obj.id),
            "name": obj.name,
            "desc": obj.desc,
            "scopes": obj.scopes,
            "is_global": obj.is_global,
            "allowed": obj in allowed_roles,
        }
