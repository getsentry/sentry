from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.utils.snuba import SnubaTSResult
from sentry.api.serializers import serialize
from sentry.api.serializers.models.user import UserSerializer
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.incidents.models import IncidentActivity
from sentry.utils.db import attach_foreignkey


@register(IncidentActivity)
class IncidentActivitySerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        attach_foreignkey(item_list, IncidentActivity.incident, related=("organization",))
        attach_foreignkey(item_list, IncidentActivity.event_stats_snapshot)
        attach_foreignkey(item_list, IncidentActivity.user)
        user_serializer = UserSerializer()
        serialized_users = serialize(
            set(item.user for item in item_list if item.user_id),
            user=user,
            serializer=user_serializer,
        )
        user_lookup = {user["id"]: user for user in serialized_users}
        return {item: {"user": user_lookup.get(six.text_type(item.user_id))} for item in item_list}

    def serialize(self, obj, attrs, user):
        incident = obj.incident

        event_stats = None
        if obj.event_stats_snapshot:
            serializer = SnubaTSResultSerializer(obj.incident.organization, None, user)
            event_stats = serializer.serialize(
                SnubaTSResult(
                    obj.event_stats_snapshot.snuba_values,
                    obj.event_stats_snapshot.start,
                    obj.event_stats_snapshot.end,
                    obj.event_stats_snapshot.period,
                )
            )

        return {
            "id": six.text_type(obj.id),
            "incidentIdentifier": six.text_type(incident.identifier),
            "user": attrs["user"],
            "type": obj.type,
            "value": obj.value,
            "previousValue": obj.previous_value,
            "comment": obj.comment,
            "eventStats": event_stats,
            "dateCreated": obj.date_added,
        }
