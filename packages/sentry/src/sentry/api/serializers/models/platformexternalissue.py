from sentry.api.serializers import Serializer, register
from sentry.models import PlatformExternalIssue


@register(PlatformExternalIssue)
class PlatformExternalIssueSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "issueId": str(obj.group_id),
            "serviceType": obj.service_type,
            "displayName": obj.display_name,
            "webUrl": obj.web_url,
        }
