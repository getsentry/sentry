from sentry.models.activity import Activity
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.activity_registry.base import (
    NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES,
    build_activity_data,
    require_config,
    send_activity_notification,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.notification_action.types import ActivityHandler
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.strategies.issue_owners import (
    IssueOwnersActivityAlertStrategy,
)
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.templates.workflow_engine import (
    ActivityAlertAction,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation


@activity_handler_registry.register(Action.Type.EMAIL)
class EmailActivityHandler(ActivityHandler):
    compatible_activity_types = NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES

    @classmethod
    def invoke_using_issue_owners_strategy(
        cls, invocation: ActionInvocation, activity: Activity
    ) -> None:
        group = activity.group
        if group is None:
            raise ValueError(f"Activity {activity.id} has no associated group")
        strategy = IssueOwnersActivityAlertStrategy(group=group)
        data = build_activity_data(invocation, activity)
        NotificationService[ActivityAlertAction](data=data).notify_sync(strategy=strategy)

    @classmethod
    def invoke_action(cls, invocation: ActionInvocation, activity: Activity) -> None:
        if invocation.action.config.get("target_type") == ActionTarget.ISSUE_OWNERS:
            return cls.invoke_using_issue_owners_strategy(invocation, activity)

        target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id=require_config(invocation.action, "target_identifier"),
        )
        send_activity_notification(invocation, activity, target)
