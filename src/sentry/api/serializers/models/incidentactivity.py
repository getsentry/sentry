from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.api.serializers import serialize
from sentry.api.serializers.models.user import UserSerializer
from sentry.incidents.models import IncidentActivity
from sentry.utils.db import attach_foreignkey


@register(IncidentActivity)
class IncidentActivitySerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        attach_foreignkey(item_list, IncidentActivity.incident, related=("organization",))
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

        return {
            "id": six.text_type(obj.id),
            "incidentIdentifier": six.text_type(incident.identifier),
            "user": attrs["user"],
            "type": obj.type,
            "value": obj.value,
            "previousValue": obj.previous_value,
            "comment": obj.comment,
            "dateCreated": obj.date_added,
        }
