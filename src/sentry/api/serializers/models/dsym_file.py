from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import ProjectDSymFile, GlobalDSymFile


@register(ProjectDSymFile)
@register(GlobalDSymFile)
class DSymFileSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': six.text_type(obj.id),
            'uuid': obj.uuid,
            'cpuName': obj.cpu_name,
            'objectName': obj.object_name,
            'symbolType': obj.dsym_type,
            'headers': obj.file.headers,
            'size': obj.file.size,
            'sha1': obj.file.checksum,
            'dateCreated': obj.file.timestamp,
        }
        return d
