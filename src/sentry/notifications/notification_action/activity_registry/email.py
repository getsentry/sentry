import logging

from sentry.models.activity import Activity
from sentry.models.team import Team
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.activity_registry.base import (
    NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES,
    require_config,
    send_activity_notification,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.notification_action.types import ActivityHandler
from sentry.notifications.platform.strategies.actor_routing import (
    TeamRoutingStrategy,
    UserRoutingStrategy,
)
from sentry.notifications.platform.strategies.issue_owners import (
    IssueOwnersActivityAlertStrategy,
)
from sentry.notifications.platform.types import NotificationStrategy
from sentry.notifications.types import NotificationSettingEnum
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)


@activity_handler_registry.register(Action.Type.EMAIL)
class EmailActivityHandler(ActivityHandler):
    compatible_activity_types = NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES

    @classmethod
    def prepare_user_participant_strategy(
        cls, invocation: ActionInvocation, activity: Activity
    ) -> NotificationStrategy:
        user_id = int(require_config(invocation.action, "target_identifier"))
        return UserRoutingStrategy(
            user_ids=[user_id],
            project=activity.project,
            settings_key=NotificationSettingEnum.ISSUE_ALERTS,
        )

    @classmethod
    def prepare_team_participant_strategy(
        cls, invocation: ActionInvocation, activity: Activity
    ) -> NotificationStrategy:
        team_id = int(require_config(invocation.action, "target_identifier"))
        team = Team.objects.get_or_none(
            id=team_id, organization_id=activity.project.organization_id
        )
        if team is None:
            raise ValueError(f"Team {team_id} could not be resolved")
        return TeamRoutingStrategy(
            teams=[team],
            project=activity.project,
            settings_key=NotificationSettingEnum.ISSUE_ALERTS,
        )

    @classmethod
    def prepare_issue_owners_strategy(
        cls, invocation: ActionInvocation, activity: Activity
    ) -> NotificationStrategy:
        group = activity.group
        if group is None:
            raise ValueError(f"Activity {activity.id} has no associated group")
        return IssueOwnersActivityAlertStrategy(group=group)

    @classmethod
    def invoke_action(cls, invocation: ActionInvocation, activity: Activity) -> None:
        target_type = invocation.action.config.get("target_type")

        match target_type:
            case ActionTarget.USER:
                strategy = cls.prepare_user_participant_strategy(invocation, activity)
            case ActionTarget.TEAM:
                strategy = cls.prepare_team_participant_strategy(invocation, activity)
            case ActionTarget.ISSUE_OWNERS:
                strategy = cls.prepare_issue_owners_strategy(invocation, activity)
            case _:
                logger.warning(
                    "invalid_action_target",
                    extra={"target_type": target_type, "activity_id": activity.id},
                )
                return

        for target in strategy.get_targets():
            send_activity_notification(invocation, activity, target)
