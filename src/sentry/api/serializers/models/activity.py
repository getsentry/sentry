from __future__ import absolute_import

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Activity


@register(Activity)
class ActivitySerializer(Serializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer); assert on relations
        users = dict(zip(
            item_list,
            serialize([i.user for i in item_list], user)
        ))

        return {
            item: {
                'user': users[item],
            } for item in item_list
        }

    def serialize(self, obj, attrs, user):
        return {
            'id': str(obj.id),
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

        projects = dict(zip(
            item_list,
            serialize([i.project for i in item_list], user)
        ))

        for item in item_list:
            attrs[item]['project'] = projects[item]
        return attrs

    def serialize(self, obj, attrs, user):
        context = super(OrganizationActivitySerializer, self).serialize(
            obj, attrs, user,
        )
        context['project'] = attrs['project']
        return context
