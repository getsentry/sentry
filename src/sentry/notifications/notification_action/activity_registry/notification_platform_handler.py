from sentry.models.activity import Activity
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.notification_action.types import ActivityHandler
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation


@activity_handler_registry.register(Action.Type.EMAIL)
@activity_handler_registry.register(Action.Type.SLACK)
@activity_handler_registry.register(Action.Type.SLACK_STAGING)
@activity_handler_registry.register(Action.Type.MSTEAMS)
@activity_handler_registry.register(Action.Type.DISCORD)
class NotificationPlatformActivityHandler(ActivityHandler):
    compatible_activity_types = [
        ActivityType.SEER_RCA_STARTED,
        ActivityType.SEER_RCA_COMPLETED,
        ActivityType.SEER_SOLUTION_STARTED,
        ActivityType.SEER_SOLUTION_COMPLETED,
        ActivityType.SEER_CODING_STARTED,
        ActivityType.SEER_CODING_COMPLETED,
        ActivityType.SEER_PR_CREATED,
    ]

    @classmethod
    def invoke_action(cls, invocation: ActionInvocation, activity: Activity) -> None:
        # TODO(Leander): Implement this. The compatible_activity_types should be all activities that
        # we have templates registered for in the notification platform. Here we'll fetch those
        # templates, create a target from the ActionInvocation, and use the service to fire.
        pass
