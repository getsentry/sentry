from sentry import features
from sentry.api.serializers import Serializer, serialize
from sentry.models.eventuser import EventUser as EventUser_model
from sentry.models.project import Project
from sentry.search.utils import convert_user_tag_to_query
from sentry.utils.eventuser import EventUser


class EnvironmentTagValueSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {"id": str(obj.id), "name": obj.value}


class UserTagValueSerializer(Serializer):
    def __init__(self, project_id):
        self.project_id = project_id

    def get_attrs(self, item_list, user):
        projects = Project.objects.filter(id=self.project_id)
        if features.has("organizations:eventuser-from-snuba", projects[0].organization):
            users = EventUser.for_tags(
                project_id=self.project_id, values=[t.value for t in item_list]
            )
        else:
            users = EventUser_model.for_tags(
                project_id=self.project_id, values=[t.value for t in item_list]
            )

        result = {}
        for item in item_list:
            result[item] = {"user": users.get(item.value)}
        return result

    def serialize(self, obj, attrs, user):
        if isinstance(attrs["user"], EventUser):
            result = attrs["user"].serialize()
        elif isinstance(attrs["user"], EventUser_model):
            result = serialize(attrs["user"], user)
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
