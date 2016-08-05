from __future__ import absolute_import

import six

from sentry.api.serializers import register, serialize, Serializer
from sentry.models import UserReport


@register(UserReport)
class UserReportSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        # TODO(dcramer): add in various context from the event
        # context == user / http / extra interfaces
        return {
            'id': six.text_type(obj.id),
            'eventID': obj.event_id,
            'name': obj.name,
            'email': obj.email,
            'comments': obj.comments,
            'dateCreated': obj.date_added,
        }


class ProjectUserReportSerializer(UserReportSerializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer); assert on relations
        groups = {
            d['id']: d
            for d in serialize(set(i.group for i in item_list if i.group_id), user)
        }

        attrs = {}
        for item in item_list:
            attrs[item] = {
                'group': groups[six.text_type(item.group_id)] if item.group_id else None,
            }
        return attrs

    def serialize(self, obj, attrs, user):
        context = super(ProjectUserReportSerializer, self).serialize(
            obj, attrs, user,
        )
        context['issue'] = attrs['group']
        return context
