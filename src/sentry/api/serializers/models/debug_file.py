from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.debugfile import ProjectDebugFile


class DebugFileSerializerResponse(TypedDict):
    id: str
    uuid: str
    debugId: str
    codeId: str | None
    cpuName: str
    objectName: str
    symbolType: str
    headers: dict[str, str]
    size: int
    sha1: str
    dateCreated: datetime
    data: dict[str, Any]


@register(ProjectDebugFile)
class DebugFileSerializer(Serializer[DebugFileSerializerResponse]):
    def serialize(self, obj, attrs, user, **kwargs) -> DebugFileSerializerResponse:
        return {
            "id": str(obj.id),
            "uuid": obj.debug_id[:36],
            "debugId": obj.debug_id,
            "codeId": obj.code_id,
            "cpuName": obj.cpu_name,
            "objectName": obj.object_name,
            "symbolType": obj.file_format,
            "headers": obj.file.headers,
            "size": obj.file.size,
            "sha1": obj.file.checksum,
            "dateCreated": obj.file.timestamp,
            "data": obj.data or {},
        }
