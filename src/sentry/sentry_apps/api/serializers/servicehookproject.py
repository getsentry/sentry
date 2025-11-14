from typing import int
from sentry.api.serializers import Serializer, register
from sentry.sentry_apps.models.servicehook import ServiceHookProject


@register(ServiceHookProject)
class ServiceHookProjectSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "project_id": str(obj.project_id),
        }
