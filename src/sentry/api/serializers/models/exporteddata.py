from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.data_export.base import ExportQueryType, ExportStatus
from sentry.data_export.models import ExportedData
from sentry.users.services.user.service import user_service


class ExportedDataUserResponse(TypedDict):
    id: str
    email: str
    username: str


class ExportedDataQueryResponse(TypedDict):
    type: str
    info: dict[str, Any]


class ExportedDataResponse(TypedDict):
    id: int
    user: ExportedDataUserResponse | None
    dateCreated: datetime
    dateFinished: datetime | None
    dateExpired: datetime | None
    query: ExportedDataQueryResponse
    status: ExportStatus
    checksum: str | None
    fileName: str | None
    export_format: str | None


@register(ExportedData)
class ExportedDataSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        attrs = {}
        serialized_users = {
            u["id"]: u
            for u in user_service.serialize_many(
                filter=dict(user_ids=[item.user_id for item in item_list])
            )
        }
        for item in item_list:
            if str(item.user_id) in serialized_users:
                serialized_user = serialized_users[str(item.user_id)]
                attrs[item] = {
                    "user": {
                        "id": serialized_user["id"],
                        "email": serialized_user["email"],
                        "username": serialized_user["username"],
                    }
                }
            else:
                attrs[item] = {}
        return attrs

    def serialize(self, obj, attrs, user, **kwargs) -> ExportedDataResponse:
        file = obj._get_file()
        if file is None:
            checksum = None
            file_name = None
        else:
            checksum = file.checksum
            file_name = file.name

        return {
            "id": obj.id,
            "user": attrs.get("user"),
            "dateCreated": obj.date_added,
            "dateFinished": obj.date_finished,
            "dateExpired": obj.date_expired,
            "query": {"type": ExportQueryType.as_str(obj.query_type), "info": obj.query_info},
            "status": obj.status,
            "checksum": checksum,
            "fileName": file_name,
            "export_format": obj.export_format,
        }
