from sentry.api.serializers import Serializer
from sentry.search.utils import convert_user_tag_to_query
from sentry.utils.eventuser import EventUser


class EnvironmentTagValueSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {"id": str(obj.id), "name": obj.value}


class UserTagValueSerializer(Serializer):
    def __init__(self, project_id):
        self.project_id = project_id

    def get_attrs(self, item_list, user):
        users = EventUser.for_tags(project_id=self.project_id, values=[t.value for t in item_list])
        result = {}
        for item in item_list:
            result[item] = {"user": users.get(item.value)}
        return result

    def serialize(self, obj, attrs, user):
        if isinstance(attrs["user"], EventUser):
            result = attrs["user"].serialize()
        else:
            result = {"id": None}

        query = convert_user_tag_to_query("user", obj.value)
        if query:
            result["query"] = query

        result.update(
            {
                "value": obj.value,
                "count": obj.times_seen,
                "lastSeen": obj.last_seen,
                "firstSeen": obj.first_seen,
            }
        )
        return result
