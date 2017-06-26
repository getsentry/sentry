from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import (
    GroupTombstone
)


@register(GroupTombstone)
class GroupTombstoneSerializer(Serializer):

    def get_attrs(self, item_list, user):
        projects = {
            d['id']: d
            for d in serialize(set(i.project for i in item_list), user)
        }

        attrs = {}
        for item in item_list:
            attrs[item] = {
                'project': projects[six.text_type(item.project_id)]
            }
        return attrs

    def serialize(self, obj, attrs, user):
        d = {
            'id': six.text_type(obj.id),
            'project': attrs.get('project', ''),
            'level': six.text_type(obj.level),
            'message': obj.message,
            'culprit': obj.culprit,
            'type': obj.type,
        }

        return d
