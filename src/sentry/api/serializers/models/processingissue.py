from sentry.api.serializers import Serializer, register
from sentry.models.processingissue import ProcessingIssue


@register(ProcessingIssue)
class ProcessingIssueSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "type": obj.type,
            "checksum": obj.checksum,
            "numEvents": 0,
            "data": obj.data,
            "lastSeen": obj.datetime,
        }
