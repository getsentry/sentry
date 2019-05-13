from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import ReleaseFile


@register(ReleaseFile)
class ReleaseFileSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "name": obj.name,
            "dist": obj.dist_id and obj.dist.name or None,
            "headers": obj.file.headers,
            "size": obj.file.size,
            "sha1": obj.file.checksum,
            "dateCreated": obj.file.timestamp,
        }
