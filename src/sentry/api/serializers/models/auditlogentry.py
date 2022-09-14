import re

from django.db.models import prefetch_related_objects
from sentry_sdk import capture_exception

from sentry import audit_log
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


def override_actor_id(user):
    # overrides the usage of actor_id only to make SCIM token
    # name more readable (for now)
    scim_prefix = "scim-internal-integration-"
    scim_regex = re.compile(
        scim_prefix
        + r"[0-9a-fA-F]{6}\-[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{7}"
    )
    scim_match = re.match(scim_regex, user.get_display_name())
    return scim_match


@register(AuditLogEntry)
class AuditLogEntrySerializer(Serializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer); assert on relations
        prefetch_related_objects(item_list, "actor")
        prefetch_related_objects(item_list, "target_user")

        users = {
            d["id"]: d
            for d in serialize(
                {i.actor for i in item_list if i.actor_id}
                | {i.target_user for i in item_list if i.target_user_id},
                user,
            )
        }

        return {
            item: {
                "actor": users[str(item.actor_id)]
                if item.actor_id and not override_actor_id(item.actor)
                else {"name": item.get_actor_name()},
                "targetUser": users.get(str(item.target_user_id)) or item.target_user_id,
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user):
        audit_log_event = audit_log.get(obj.event)

        try:
            note = audit_log_event.render(obj)
        except KeyError as exc:
            note = ""
            capture_exception(exc)

        return {
            "id": str(obj.id),
            "actor": attrs["actor"],
            "event": audit_log_event.api_name,
            "ipAddress": obj.ip_address,
            "note": note,
            "targetObject": obj.target_object,
            "targetUser": attrs["targetUser"],
            "data": fix(obj.data),
            "dateCreated": obj.datetime,
        }
