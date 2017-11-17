from __future__ import absolute_import

import six

from sentry.api.serializers import register, serialize, Serializer
from sentry.models import EventUser, UserReport, Event


@register(UserReport)
class UserReportSerializer(Serializer):
    def get_attrs(self, item_list, user):
        queryset = list(EventUser.objects.filter(
            id__in=[i.event_user_id for i in item_list],
        ))

        event_users = {e.id: d for e, d in zip(queryset, serialize(queryset, user))}

        events_list = Event.objects.filter(
            event_id__in=[i.event_id for i in item_list]
        ).values('id', 'event_id')

        events_dict = {e['event_id']: e['id'] for e in events_list}

        attrs = {}
        for item in item_list:
            attrs[item] = {
                'event_user': event_users.get(item.event_user_id),
                'event_id': events_dict.get(item.event_id)
            }

        return attrs

    def serialize(self, obj, attrs, user):
        # TODO(dcramer): add in various context from the event
        # context == user / http / extra interfaces
        return {
            'id': six.text_type(obj.id),
            'eventID': obj.event_id,
            'name': (
                obj.name or obj.email or
                (attrs['event_user'].get_display_name() if attrs['event_user'] else None)
            ),
            'email': (obj.email or (attrs['event_user'].email if attrs['event_user'] else None)),
            'comments': obj.comments,
            'dateCreated': obj.date_added,
            'user': attrs['event_user'],
            'event_id': six.text_type(attrs['event_id'])
        }


class ProjectUserReportSerializer(UserReportSerializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer); assert on relations
        groups = {
            d['id']: d for d in serialize(set(i.group for i in item_list if i.group_id), user)
        }

        attrs = super(ProjectUserReportSerializer, self).get_attrs(item_list, user)
        for item in item_list:
            attrs[item].update(
                {
                    'group': groups[six.text_type(item.group_id)] if item.group_id else None,
                }
            )
        return attrs

    def serialize(self, obj, attrs, user):
        context = super(ProjectUserReportSerializer, self).serialize(
            obj,
            attrs,
            user,
        )
        context['issue'] = attrs['group']
        return context
