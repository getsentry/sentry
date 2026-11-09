from collections.abc import Mapping, Sequence
from typing import Annotated, Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
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


class OutgoingNotificationActionResponse(TypedDict):
    id: Annotated[int, ApiDescription("ID of the notification action")]
    organizationId: Annotated[int, ApiDescription("ID of the organization")]
    integrationId: Annotated[
        int | None,
        ApiDescription("ID of the integration that sends the notification. Null when none is used"),
    ]
    sentryAppId: Annotated[
        int | None,
        ApiDescription(
            "ID of the Sentry app that receives the notification. Null when none is used"
        ),
    ]
    projects: Annotated[list[int], ApiDescription("IDs of the projects the action applies to")]
    serviceType: Annotated[
        str | None,
        ApiDescription("Service that sends the notification, such as email, slack or pagerduty"),
    ]
    triggerType: Annotated[
        str, ApiDescription("What triggers the action, such as audit-log or spike-protection")
    ]
    targetType: Annotated[
        str | None,
        ApiDescription("Kind of target: specific, user, team, sentry_app or issue_owners"),
    ]
    targetIdentifier: Annotated[
        str | None, ApiDescription("ID of the target in the service, such as a Slack channel ID")
    ]
    targetDisplay: Annotated[str | None, ApiDescription("Name of the target, such as #alerts")]


class NotificationActionAttrs(TypedDict):
    trigger_type: str
    projects: list[int]


@register(NotificationAction)
class OutgoingNotificationActionSerializer(Serializer[OutgoingNotificationActionResponse]):
    """
    Model serializer for outgoing NotificationAction API payloads
    """

    def get_attrs(
        self,
        item_list: Sequence[NotificationAction],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[NotificationAction, NotificationActionAttrs]:
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

    def serialize(
        self,
        obj: NotificationAction,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> OutgoingNotificationActionResponse:
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
    def get_example(cls, **action_kwargs: object) -> OutgoingNotificationActionResponse:
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
