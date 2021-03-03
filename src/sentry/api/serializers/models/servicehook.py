from sentry.api.serializers import Serializer, register
from sentry.models import ServiceHook


@register(ServiceHook)
class ServiceHookSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": obj.guid,
            "url": obj.url,
            "secret": obj.secret,
            "status": obj.get_status_display(),
            "events": sorted(obj.events),
            "dateCreated": obj.date_added,
        }
