from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import ApiToken


@register(ApiToken)
class ApiTokenSerializer(Serializer):
    def get_attrs(self, item_list, user):
        apps = {
            d['id']: d
            for d in serialize(set(i.application for i in item_list if i.application_id), user)
        }

        attrs = {}
        for item in item_list:
            attrs[item] = {
                'application': apps[six.text_type(item.application_id)] if item.application_id else None,
            }
        return attrs

    def serialize(self, obj, attrs, user):
        return {
            'token': obj.token,
            'scopes': [k for k, v in six.iteritems(obj.scopes) if v],
            'application': attrs['application'],
            'expiresAt': obj.expires_at,
            'dateCreated': obj.date_added,
        }
