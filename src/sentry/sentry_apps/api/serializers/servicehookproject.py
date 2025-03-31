from sentry.api.serializers import Serializer, register
from sentry.sentry_apps.models.servicehook import ServiceHookProject


@register(ServiceHookProject)
class ServiceHookProjectSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": obj.id,
            "project_id": obj.project_id,
        }
