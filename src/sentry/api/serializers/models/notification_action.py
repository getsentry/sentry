from sentry.api.serializers import Serializer, register
from sentry.models.notificationaction import ActionService, ActionTarget, NotificationAction


@register(NotificationAction)
class NotificationActionSerializer(Serializer):
    def serialize(self, obj: NotificationAction, attrs, user, **kwargs):

        result = {
            "id": obj.id,
            "organizationId": obj.organization_id,
            "integrationId": obj.integration_id,
            "sentryAppId": obj.sentry_app_id,
            "projects": [],  # get from attrs
            "serviceType": ActionService.get_name(obj.service_type),
            "triggerType": "",  # get from attrs
            "targetType": ActionTarget.get_name(obj.target_type),
            "targetIdentifier": obj.target_identifier,
            "targetDisplay": obj.target_display,
        }

        return result
