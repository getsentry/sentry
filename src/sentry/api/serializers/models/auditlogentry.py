from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import AuditLogEntry


def fix(data):
    # There was a point in time where full Team objects
    # got serialized into our AuditLogEntry.data, so these
    # values need to be stripped and reduced down to integers
    if data.get("teams"):
        if hasattr(data["teams"][0], "id"):
            data["teams"] = [t.id for t in data["teams"]]

    return data


@register(AuditLogEntry)
class AuditLogEntrySerializer(Serializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer); assert on relations
        users = {
            d["id"]: d
            for d in serialize(
                set(i.actor for i in item_list if i.actor_id)
                | set(i.target_user for i in item_list if i.target_user_id),
                user,
            )
        }

        return {
            item: {
                "actor": users[six.text_type(item.actor_id)]
                if item.actor_id
                else {"name": item.get_actor_name()},
                "targetUser": users.get(six.text_type(item.target_user_id)) or item.target_user_id,
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "actor": attrs["actor"],
            "event": obj.get_event_display(),
            "ipAddress": obj.ip_address,
            "note": obj.get_note(),
            "targetObject": obj.target_object,
            "targetUser": attrs["targetUser"],
            "data": fix(obj.data),
            "dateCreated": obj.datetime,
        }
