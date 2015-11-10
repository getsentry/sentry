from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import ReleaseFile


@register(ReleaseFile)
class ReleaseFileSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        # TODO(dcramer): remove legacy attributes when data conversion
        # is completed
        blob = obj.file.blob
        if blob:
            size = blob.size
            checksum = blob.checksum
        else:
            size = obj.file.size
            checksum = obj.file.checksum

        d = {
            'id': str(obj.id),
            'name': obj.name,
            'headers': obj.file.headers,
            'size': size,
            'sha1': checksum,
            'dateCreated': obj.file.timestamp,
        }
        return d
