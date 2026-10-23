from unittest.mock import MagicMock, patch

from sentry.integrations.slack.message_builder.routing import (
    SlackActionTracking,
    add_action_tracking,
    encode_action_id,
)
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.notifications.platform.tracking import (
    NotificationEngagementMechanism,
    NotificationTrackingContext,
)
from sentry.notifications.platform.types import NotificationCategory, NotificationSource
from sentry.testutils.helpers.options import override_options
from tests.sentry.integrations.slack.webhooks.actions import BaseEventTest

TRACKED_SOURCES = {"notifications.tracking.sources": [NotificationSource.SEER_AGENT_WRITE_APPROVAL]}


@patch("sentry.integrations.slack.webhooks.action.record_engagement")
class TrackedClickTest(BaseEventTest):
    def setUp(self) -> None:
        super().setUp()
        self.action_id = encode_action_id(
            action=SlackAction.SEER_AGENT_WRITE_REJECT,
            organization_id=self.organization.id,
            project_id=None,
        )
        self.tracking = SlackActionTracking(
            notification_uuid="6f3c9a52-1b9e-4b1f-9d8e-2a4c5e6f7a8b",
            source=NotificationSource.SEER_AGENT_WRITE_APPROVAL,
        )

    def _click(self, action_id: str) -> None:
        resp = self.post_webhook_block_kit(
            action_data=[
                {
                    "type": "button",
                    "action_id": action_id,
                    "text": {"type": "plain_text", "text": "Reject"},
                    "value": "link_clicked",
                }
            ]
        )
        assert resp.status_code == 200, resp.content

    @override_options(TRACKED_SOURCES)
    def test_records_click_on_tracked_button(self, mock_record_engagement: MagicMock) -> None:
        tracked_action_id = add_action_tracking(self.action_id, self.tracking)
        assert tracked_action_id is not None

        self._click(tracked_action_id)

        mock_record_engagement.assert_called_once_with(
            NotificationTrackingContext(
                source=NotificationSource.SEER_AGENT_WRITE_APPROVAL,
                provider="slack",
                category=NotificationCategory.SEER,
                notification_uuid=self.tracking.notification_uuid,
                organization_id=self.organization.id,
            ),
            mechanism=NotificationEngagementMechanism.PROVIDER_CALLBACK,
            link=SlackAction.SEER_AGENT_WRITE_REJECT,
            user_id=self.user.id,
        )

    @override_options(TRACKED_SOURCES)
    def test_ignores_untracked_button(self, mock_record_engagement: MagicMock) -> None:
        self._click(self.action_id)

        mock_record_engagement.assert_not_called()

    def test_ignores_button_when_tracking_is_disabled(
        self, mock_record_engagement: MagicMock
    ) -> None:
        tracked_action_id = add_action_tracking(self.action_id, self.tracking)
        assert tracked_action_id is not None

        self._click(tracked_action_id)

        mock_record_engagement.assert_not_called()

    @override_options({"notifications.tracking.sources": ["unregistered-source"]})
    def test_unknown_source_does_not_break_the_action(
        self, mock_record_engagement: MagicMock
    ) -> None:
        tracked_action_id = add_action_tracking(
            self.action_id,
            SlackActionTracking(notification_uuid="abc", source="unregistered-source"),
        )
        assert tracked_action_id is not None

        self._click(tracked_action_id)

        mock_record_engagement.assert_not_called()
