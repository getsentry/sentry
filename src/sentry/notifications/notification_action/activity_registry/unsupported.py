import logging

from sentry.models.activity import Activity
from sentry.notifications.notification_action.activity_registry.base import (
    NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.notification_action.types import ActivityHandler
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)


@activity_handler_registry.register(Action.Type.PAGERDUTY)
@activity_handler_registry.register(Action.Type.OPSGENIE)
@activity_handler_registry.register(Action.Type.GITHUB)
@activity_handler_registry.register(Action.Type.GITHUB_ENTERPRISE)
@activity_handler_registry.register(Action.Type.JIRA)
@activity_handler_registry.register(Action.Type.JIRA_SERVER)
@activity_handler_registry.register(Action.Type.AZURE_DEVOPS)
@activity_handler_registry.register(Action.Type.SENTRY_APP)
@activity_handler_registry.register(Action.Type.PLUGIN)
@activity_handler_registry.register(Action.Type.WEBHOOK)
class UnsupportedActivityHandler(ActivityHandler):
    compatible_activity_types = NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES

    @classmethod
    def invoke_action(cls, invocation: ActionInvocation, activity: Activity) -> None:
        try:
            activity_type_name = ActivityType(activity.type).name
        except ValueError:
            activity_type_name = str(activity.type)

        logger.info(
            "notification_action.activity.unsupported",
            extra={
                "action_id": invocation.action.id,
                "action_type": invocation.action.type,
                "activity_type": activity.type,
                "activity_type_name": activity_type_name,
            },
        )
