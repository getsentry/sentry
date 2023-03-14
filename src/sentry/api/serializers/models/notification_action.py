from typing import Sequence

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.models.user import manytoone_to_dict
from sentry.models.notificationaction import (
    ActionService,
    ActionTarget,
    NotificationAction,
    NotificationActionProject,
    TriggerGenerator,
)


@register(NotificationAction)
class NotificationActionSerializer(Serializer):
    def get_attrs(self, item_list: Sequence[NotificationAction], user):
        action_ids = {i.id for i in item_list}
        projects_by_action_id = manytoone_to_dict(
            NotificationActionProject.objects.filter(action_id__in=action_ids),
            "action_id",
        )
        valid_triggers = dict(list(TriggerGenerator()))
        return {
            item: {
                "trigger_type": valid_triggers[item.trigger_type],
                "projects": [p.project_id for p in projects_by_action_id[item.id]],
            }
            for item in item_list
        }

    def serialize(self, obj: NotificationAction, attrs, user, **kwargs):
        result = {
            "id": obj.id,
            "organizationId": obj.organization_id,
            "integrationId": obj.integration_id,
            "sentryAppId": obj.sentry_app_id,
            "projects": attrs["projects"],
            "serviceType": ActionService.get_name(obj.service_type),
            "triggerType": attrs["trigger_type"],
            "targetType": ActionTarget.get_name(obj.target_type),
            "targetIdentifier": obj.target_identifier,
            "targetDisplay": obj.target_display,
        }

        return result
