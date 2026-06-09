from sentry.notifications.notification_action.activity_registry.discord import (
    DiscordActivityHandler,
)
from sentry.notifications.notification_action.activity_registry.email import EmailActivityHandler
from sentry.notifications.notification_action.activity_registry.msteams import (
    MSTeamsActivityHandler,
)
from sentry.notifications.notification_action.activity_registry.slack import SlackActivityHandler
from sentry.types.activity import ActivityType


class TestCompatibleActivityTypes:
    def test_all_handlers_share_compatible_activity_types(self) -> None:
        expected_activity_types = [
            ActivityType.SEER_RCA_STARTED,
            ActivityType.SEER_RCA_COMPLETED,
            ActivityType.SEER_SOLUTION_STARTED,
            ActivityType.SEER_SOLUTION_COMPLETED,
            ActivityType.SEER_CODING_STARTED,
            ActivityType.SEER_CODING_COMPLETED,
            ActivityType.SEER_PR_CREATED,
        ]
        for handler in [
            SlackActivityHandler,
            DiscordActivityHandler,
            MSTeamsActivityHandler,
            EmailActivityHandler,
        ]:
            for activity_type in expected_activity_types:
                assert activity_type in handler.compatible_activity_types
