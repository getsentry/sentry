from __future__ import absolute_import

from sentry.api.serializers import Serializer, serialize, register
from sentry.models import User
from sentry.data_export.base import ExportQueryType
from sentry.data_export.models import ExportedData


@register(ExportedData)
class ExportedDataSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        attrs = {}
        users = User.objects.filter(id__in=set([item.user_id for item in item_list]))
        user_lookup = {user.id: user for user in users}
        for item in item_list:
            user = user_lookup[item.user_id]
            serialized_user = serialize(user)
            attrs[item] = {
                "user": {
                    "id": serialized_user["id"],
                    "email": serialized_user["email"],
                    "username": serialized_user["username"],
                }
            }
        return attrs

    def serialize(self, obj, attrs, user, **kwargs):
        if obj.file is None:
            checksum = None
            file_name = None
        else:
            checksum = obj.file.checksum
            file_name = obj.file.name

        return {
            "id": obj.id,
            "user": attrs["user"],
            "dateCreated": obj.date_added,
            "dateFinished": obj.date_finished,
            "dateExpired": obj.date_expired,
            "query": {"type": ExportQueryType.as_str(obj.query_type), "info": obj.query_info},
            "status": obj.status,
            "checksum": checksum,
            "fileName": file_name,
        }
