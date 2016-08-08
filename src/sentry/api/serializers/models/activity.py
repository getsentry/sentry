from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Activity


@register(Activity)
class ActivitySerializer(Serializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer); assert on relations
        users = {
            d['id']: d
            for d in serialize(set(i.user for i in item_list if i.user_id), user)
        }

        return {
            item: {
                'user': users[six.text_type(item.user_id)] if item.user_id else None,
            } for item in item_list
        }

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'user': attrs['user'],
            'type': obj.get_type_display(),
            'data': obj.data,
            'dateCreated': obj.datetime,
        }


class OrganizationActivitySerializer(ActivitySerializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer); assert on relations
        attrs = super(OrganizationActivitySerializer, self).get_attrs(
            item_list, user,
        )

        groups = {
            d['id']: d
            for d in serialize(set(i.group for i in item_list if i.group_id), user)
        }

        projects = {
            d['id']: d
            for d in serialize(set(i.project for i in item_list), user)
        }

        for item in item_list:
            attrs[item]['issue'] = groups[six.text_type(item.group_id)] if item.group_id else None
            attrs[item]['project'] = projects[six.text_type(item.project_id)]
        return attrs

    def serialize(self, obj, attrs, user):
        context = super(OrganizationActivitySerializer, self).serialize(
            obj, attrs, user,
        )
        context['issue'] = attrs['issue']
        context['project'] = attrs['project']
        return context
