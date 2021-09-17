from sentry.api.serializers import Serializer, register, serialize
from sentry.models import EventUser, Group, UserReport
from sentry.utils.compat import zip


@register(UserReport)
class UserReportSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
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

    def serialize(self, obj, attrs, user, **kwargs):
        # TODO(dcramer): add in various context from the event
        # context == user / http / extra interfaces
        name = obj.name or obj.email
        email = obj.email
        if attrs["event_user"]:
            event_user = attrs["event_user"]
            if isinstance(event_user, dict):
                name = name or event_user.get("name")
                email = email or event_user.get("email")
        return {
            "id": str(obj.id),
            "eventID": obj.event_id,
            "name": name,
            "email": email,
            "comments": obj.comments,
            "dateCreated": obj.date_added,
            "user": attrs["event_user"],
            "event": {"id": obj.event_id, "eventID": obj.event_id},
        }


class UserReportWithGroupSerializer(UserReportSerializer):
    def __init__(self, environment_func=None):
        self.environment_func = environment_func

    def get_attrs(self, item_list, user, **kwargs):
        from sentry.api.serializers import GroupSerializer

        groups = list(Group.objects.filter(id__in={i.group_id for i in item_list if i.group_id}))
        serialized_groups = {}
        if groups:
            serialized_groups = {
                d["id"]: d
                for d in serialize(
                    groups,
                    user,
                    GroupSerializer(environment_func=self.environment_func),
                )
            }

        attrs = super().get_attrs(item_list, user)
        for item in item_list:
            attrs[item].update(
                {"group": serialized_groups[str(item.group_id)] if item.group_id else None}
            )
        return attrs

    def serialize(self, obj, attrs, user):
        context = super().serialize(obj, attrs, user)
        context["issue"] = attrs["group"]
        return context
