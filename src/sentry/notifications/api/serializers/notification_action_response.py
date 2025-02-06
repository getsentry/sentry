from collections.abc import Sequence
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.notifications.models.notificationaction import (
    ActionService,
    ActionTarget,
    ActionTrigger,
    NotificationAction,
    NotificationActionProject,
)
from sentry.utils.serializers import manytoone_to_dict


@register(NotificationAction)
class OutgoingNotificationActionSerializer(Serializer):
    """
    Model serializer for outgoing NotificationAction API payloads
    """

    def get_attrs(self, item_list: Sequence[NotificationAction], user, **kwargs):
        action_ids = {i.id for i in item_list}
        projects_by_action_id = manytoone_to_dict(
            NotificationActionProject.objects.filter(action_id__in=action_ids),
            "action_id",
        )
        valid_triggers: dict[int, str] = dict(NotificationAction.get_trigger_types())
        return {
            item: {
                "trigger_type": valid_triggers[item.trigger_type],
                "projects": [p.project_id for p in projects_by_action_id[item.id]],
            }
            for item in item_list
        }

    def serialize(self, obj: NotificationAction, attrs, user, **kwargs) -> dict[str, Any]:
        return {
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

    @classmethod
    def get_example(cls, **action_kwargs):
        """
        Create example serialized response for documentation.
        Any kwargs will be applied to the NotificationAction.
        """
        action = NotificationAction(
            **{
                "id": 27,
                "organization_id": 721,
                "integration_id": 916,
                "type": ActionService.SLACK.value,
                "trigger_type": ActionTrigger.AUDIT_LOG.value,
                "target_type": ActionTarget.SPECIFIC.value,
                "target_identifier": "C0123S456AL",
                "target_display": "#sentry-audit-log",
                **action_kwargs,
            }
        )
        attrs = {
            "projects": [503, 1209],
            "trigger_type": ActionTrigger.get_name(action.trigger_type),
        }
        return cls().serialize(action, attrs=attrs, user=AnonymousUser())
