from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.user import UserSerializer
from sentry.incidents.models import IncidentActivity


@register(IncidentActivity)
class IncidentActivitySerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        prefetch_related_objects(item_list, "incident__organization")
        prefetch_related_objects(item_list, "user")
        user_serializer = UserSerializer()
        serialized_users = serialize(
            {item.user for item in item_list if item.user_id},
            user=user,
            serializer=user_serializer,
        )
        user_lookup = {user["id"]: user for user in serialized_users}
        return {item: {"user": user_lookup.get(str(item.user_id))} for item in item_list}

    def serialize(self, obj, attrs, user):
        incident = obj.incident

        return {
            "id": str(obj.id),
            "incidentIdentifier": str(incident.identifier),
            "user": attrs["user"],
            "type": obj.type,
            "value": obj.value,
            "previousValue": obj.previous_value,
            "comment": obj.comment,
            "dateCreated": obj.date_added,
        }
