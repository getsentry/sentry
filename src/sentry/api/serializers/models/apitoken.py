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
                'application': (
                    apps.get(item.application.client_id)
                    if item.application else None
                ),
            }
        return attrs

    def serialize(self, obj, attrs, user):
        data = {
            'id': six.text_type(obj.id),
            'scopes': obj.get_scopes(),
            'application': attrs['application'],
            'expiresAt': obj.expires_at,
            'dateCreated': obj.date_added,
        }
        if not attrs['application']:
            data['token'] = obj.token
        return data
