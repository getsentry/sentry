from sentry.api.serializers import Serializer, register
from sentry.sentry_apps.models.servicehook import ServiceHookProject
from sentry.sentry_apps.services.cell.model import RpcServiceHookProject


@register(ServiceHookProject)
class ServiceHookProjectSerializer(Serializer):
    def serialize(self, obj: ServiceHookProject | RpcServiceHookProject, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "project_id": str(obj.project_id),
        }
