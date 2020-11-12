from __future__ import absolute_import

import six

from sentry.api.serializers import register, serialize, Serializer
from sentry.models import EventUser, UserReport
from sentry.utils.compat import zip


@register(UserReport)
class UserReportSerializer(Serializer):
    def get_attrs(self, item_list, user):
        event_user_ids = {i.event_user_id for i in item_list if i.event_user_id}

        # Avoid querying if there aren't any to actually query, it's possible
        # for event_user_id to be None.
        if event_user_ids:
            queryset = list(EventUser.objects.filter(id__in=event_user_ids))
            event_users = {e.id: d for e, d in zip(queryset, serialize(queryset, user))}
        else:
            event_users = {}

        attrs = {}
        for item in item_list:
            attrs[item] = {"event_user": event_users.get(item.event_user_id)}

        return attrs

    def serialize(self, obj, attrs, user):
        # TODO(dcramer): add in various context from the event
        # context == user / http / extra interfaces
        return {
            "id": six.text_type(obj.id),
            "eventID": obj.event_id,
            "name": (
                obj.name
                or obj.email
                or (attrs["event_user"].get_display_name() if attrs["event_user"] else None)
            ),
            "email": (obj.email or (attrs["event_user"].email if attrs["event_user"] else None)),
            "comments": obj.comments,
            "dateCreated": obj.date_added,
            "user": attrs["event_user"],
            "event": {"id": obj.event_id, "eventID": obj.event_id},
        }


class UserReportWithGroupSerializer(UserReportSerializer):
    def __init__(self, environment_func=None):
        self.environment_func = environment_func

    def get_attrs(self, item_list, user):
        from sentry.api.serializers import GroupSerializer

        # TODO(dcramer); assert on relations
        groups = {
            d["id"]: d
            for d in serialize(
                set(i.group for i in item_list if i.group_id),
                user,
                GroupSerializer(environment_func=self.environment_func),
            )
        }

        attrs = super(UserReportWithGroupSerializer, self).get_attrs(item_list, user)
        for item in item_list:
            attrs[item].update(
                {"group": groups[six.text_type(item.group_id)] if item.group_id else None}
            )
        return attrs

    def serialize(self, obj, attrs, user):
        context = super(UserReportWithGroupSerializer, self).serialize(obj, attrs, user)
        context["issue"] = attrs["group"]
        return context
