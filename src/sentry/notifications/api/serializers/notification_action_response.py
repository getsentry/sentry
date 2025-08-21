from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.notifications.models.notificationaction import (
    ActionService,
    ActionTarget,
    ActionTrigger,
    NotificationAction,
    NotificationActionProject,
)
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.serializers import manytoone_to_dict


class NotificationActionItems(TypedDict):
    trigger_type: str
    projects: list[int]


class NotificationActionResponse(TypedDict):
    id: int
    organizationId: int
    integrationId: int | None
    sentryAppId: int | None
    projects: list[int]
    serviceType: str  # ActionService
    triggerType: str
    targetType: str
    targetIdentifier: str | None
    targetDisplay: str | None


@register(NotificationAction)
class OutgoingNotificationActionSerializer(Serializer):
    """
    Model serializer for outgoing NotificationAction API payloads
    """

    def get_attrs(
        self,
        item_list: Sequence[NotificationAction],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> dict[NotificationAction, NotificationActionItems]:
        action_ids = {i.id for i in item_list}
        projects_by_action_id = manytoone_to_dict(
            NotificationActionProject.objects.filter(action_id__in=action_ids),
            "action_id",
        )
        valid_triggers: dict[int, str] = dict(NotificationAction.get_trigger_types())
        return {
            item: NotificationActionItems(
                trigger_type=valid_triggers[item.trigger_type],
                projects=[p.project_id for p in projects_by_action_id[item.id]],
            )
            for item in item_list
        }

    def serialize(
        self,
        obj: NotificationAction,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> NotificationActionResponse:
        service_type = ActionService.get_name(obj.service_type)
        target_type = ActionTarget.get_name(obj.target_type)

        if service_type is None:
            raise ValueError(
                f"Invalid service type: {obj.service_type}, service_type must be one of {ActionService.as_choices()}"
            )
        if target_type is None:
            raise ValueError(
                f"Invalid target type: {obj.target_type}, target_type must be one of {ActionTarget.as_choices()}"
            )

        return {
            "id": obj.id,
            "organizationId": obj.organization_id,
            "integrationId": obj.integration_id,
            "sentryAppId": obj.sentry_app_id,
            "projects": attrs["projects"],
            "serviceType": service_type,
            "triggerType": attrs["trigger_type"],
            "targetType": target_type,
            "targetIdentifier": obj.target_identifier,
            "targetDisplay": obj.target_display,
        }

    @classmethod
    def get_example(cls, **action_kwargs: dict[str, Any]) -> NotificationActionResponse:
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
