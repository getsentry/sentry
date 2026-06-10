from sentry.notifications.notification_action.activity_registry.notification_platform_handler import (
    NotificationPlatformActivityHandler,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action


class TestNotificationPlatformActivityHandlerRegistration:
    def test_registered_actions(self) -> None:
        expected_actions = [
            Action.Type.EMAIL,
            Action.Type.SLACK,
            Action.Type.SLACK_STAGING,
            Action.Type.MSTEAMS,
            Action.Type.DISCORD,
        ]
        for action in expected_actions:
            handler = activity_handler_registry.get(action)
            assert handler is NotificationPlatformActivityHandler

    def test_compatible_activity_types(self) -> None:
        expected_activity_types = [
            ActivityType.SEER_RCA_STARTED,
            ActivityType.SEER_RCA_COMPLETED,
            ActivityType.SEER_SOLUTION_STARTED,
            ActivityType.SEER_SOLUTION_COMPLETED,
            ActivityType.SEER_CODING_STARTED,
            ActivityType.SEER_CODING_COMPLETED,
            ActivityType.SEER_PR_CREATED,
        ]
        for activity_type in expected_activity_types:
            assert activity_type in NotificationPlatformActivityHandler.compatible_activity_types
