from collections.abc import Mapping
from datetime import datetime
from typing import Annotated, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.models.eventattachment import EventAttachment
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class EventAttachmentSerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the attachment")]
    event_id: Annotated[str, ApiDescription("ID of the event the attachment belongs to")]
    type: Annotated[
        str, ApiDescription("Type of the attachment, such as event.attachment or event.minidump")
    ]
    name: Annotated[str, ApiDescription("File name of the attachment")]
    mimetype: Annotated[str | None, ApiDescription("MIME type of the attachment")]
    dateCreated: Annotated[datetime, ApiDescription("When the attachment was stored (ISO 8601)")]
    size: Annotated[int, ApiDescription("Size of the attachment in bytes")]
    headers: Annotated[
        dict[str, str | None],
        ApiDescription("Legacy field. Only contains Content-Type, which matches mimetype"),
    ]
    sha1: Annotated[str | None, ApiDescription("Legacy field, always null")]


@register(EventAttachment)
class EventAttachmentSerializer(Serializer[EventAttachmentSerializerResponse]):
    def serialize(
        self,
        obj: EventAttachment,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> EventAttachmentSerializerResponse:
        content_type = obj.content_type
        size = obj.size or 0
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
            "sha1": None,
        }
