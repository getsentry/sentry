from datetime import datetime
from typing import int, TypedDict

from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register
from sentry.incidents.models.incident import IncidentActivity
from sentry.interfaces.user import EventUserApiContext
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.utils.legacy_metric_tracking import report_used_legacy_models


class IncidentActivitySerializerResponse(TypedDict):
    id: str
    incidentIdentifier: str
    user: EventUserApiContext
    type: int
    value: str
    previousValue: str
    comment: str
    dateCreated: datetime


@register(IncidentActivity)
class IncidentActivitySerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        prefetch_related_objects(item_list, "incident__organization")
        serialized_users = user_service.serialize_many(
            filter={"user_ids": [i.user_id for i in item_list if i.user_id]},
            as_user=serialize_generic_user(user),
        )
        user_lookup = {user["id"]: user for user in serialized_users}
        return {item: {"user": user_lookup.get(str(item.user_id))} for item in item_list}

    def serialize(self, obj, attrs, user, **kwargs) -> IncidentActivitySerializerResponse:
        # Mark that we're using legacy IncidentActivity models (which depend on Incident -> AlertRule)
        report_used_legacy_models()

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
