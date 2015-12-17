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

        group_list = list(set([i.group for i in item_list if i.group]))
        groups = dict(zip(
            [g.id for g in group_list],
            serialize(group_list, user)
        ))

        project_list = list(set([i.project for i in item_list]))
        projects = dict(zip(
            [p.id for p in project_list],
            serialize(project_list, user)
        ))

        for item in item_list:
            attrs[item]['issue'] = groups[item.group_id] if item.group_id else None
            attrs[item]['project'] = projects[item.project_id]
        return attrs

    def serialize(self, obj, attrs, user):
        context = super(OrganizationActivitySerializer, self).serialize(
            obj, attrs, user,
        )
        context['issue'] = attrs['issue']
        context['project'] = attrs['project']
        return context
