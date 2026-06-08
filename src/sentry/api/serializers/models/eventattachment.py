import mimetypes
from datetime import datetime
from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.eventattachment import EventAttachment
from sentry.models.files.file import File


class EventAttachmentSerializerResponse(TypedDict):
    id: str
    event_id: str
    type: str
    name: str
    mimetype: str | None
    dateCreated: datetime
    size: int
    headers: dict[str, str | None]
    sha1: str | None


@register(EventAttachment)
class EventAttachmentSerializer(Serializer[EventAttachmentSerializerResponse]):
    def serialize(self, obj, attrs, user, **kwargs) -> EventAttachmentSerializerResponse:
        content_type = obj.content_type
        size = obj.size or 0
        sha1 = obj.sha1
        headers = {"Content-Type": content_type}

        return {
            "id": str(obj.id),
            "event_id": obj.event_id,
            "type": obj.type,
            "name": obj.name,
            "mimetype": content_type,
            "dateCreated": obj.date_added,
            "size": size,
            # TODO: It would be nice to deprecate these two fields.
            # If not, we can at least define `headers` as `Content-Type: $mimetype`.
            "headers": headers,
            "sha1": sha1,
        }


def get_mimetype(file: File) -> str:
    rv = file.headers.get("Content-Type")
    if rv:
        return rv.split(";")[0].strip()
    return mimetypes.guess_type(file.name)[0] or "application/octet-stream"
