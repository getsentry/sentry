from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import EventAttachment


@register(EventAttachment)
class EventAttachmentSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "name": obj.name,
            "headers": obj.file.headers,
            "size": obj.file.size,
            "sha1": obj.file.checksum,
            "dateCreated": obj.file.timestamp,
            "type": obj.file.type,
        }
