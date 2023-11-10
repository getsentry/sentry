import mimetypes

from sentry.api.serializers import Serializer, register
from sentry.models.eventattachment import EventAttachment
from sentry.models.files.file import File


@register(EventAttachment)
class EventAttachmentSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        files = {f.id: f for f in File.objects.filter(id__in=[ea.file_id for ea in item_list])}
        return {ea: {"file": files[ea.file_id]} for ea in item_list}

    def serialize(self, obj, attrs, user):
        file = attrs["file"]

        return {
            "id": str(obj.id),
            "event_id": obj.event_id,
            "type": obj.type,
            "name": obj.name,
            "mimetype": get_mimetype(file),
            "dateCreated": obj.date_added,
            "size": file.size,
            # TODO: It would be nice to deprecate these two fields.
            # If not, we can at least define `headers` as `Content-Type: $mimetype`.
            "headers": file.headers,
            "sha1": file.checksum,
        }


def get_mimetype(file: File) -> str:
    rv = file.headers.get("Content-Type")
    if rv:
        return rv.split(";")[0].strip()
    return mimetypes.guess_type(file.name)[0] or "application/octet-stream"
