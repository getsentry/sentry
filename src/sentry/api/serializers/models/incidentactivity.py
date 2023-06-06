from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register
from sentry.incidents.models import IncidentActivity
from sentry.services.hybrid_cloud.user.service import user_service


@register(IncidentActivity)
class IncidentActivitySerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        prefetch_related_objects(item_list, "incident__organization")
        serialized_users = user_service.serialize_many(
            filter={"user_ids": [i.user_id for i in item_list if i.user_id]}, as_user=user
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
