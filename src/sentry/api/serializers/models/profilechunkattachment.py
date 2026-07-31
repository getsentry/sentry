from collections.abc import Mapping
from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.profilechunkattachment import ProfileChunkAttachment


class ProfileChunkAttachmentSerializerResponse(TypedDict):
    id: str
    profilerId: str
    chunkId: str
    name: str
    contentType: str | None
    dateAdded: datetime


@register(ProfileChunkAttachment)
class ProfileChunkAttachmentSerializer(Serializer[ProfileChunkAttachmentSerializerResponse]):
    def serialize(
        self,
        obj: ProfileChunkAttachment,
        attrs: Mapping[str, Any],
        user: Any,
        **kwargs: Any,
    ) -> ProfileChunkAttachmentSerializerResponse:
        return {
            "id": str(obj.id),
            "profilerId": obj.profiler_id,
            "chunkId": obj.chunk_id,
            "name": obj.name,
            "contentType": obj.content_type,
            "dateAdded": obj.date_added,
        }
