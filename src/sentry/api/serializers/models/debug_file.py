from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import ProjectDebugFile


@register(ProjectDebugFile)
class DebugFileSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            "id": six.text_type(obj.id),
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
        return d
