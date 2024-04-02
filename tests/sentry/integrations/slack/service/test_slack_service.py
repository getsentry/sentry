from sentry.integrations.slack.service import SlackService
from sentry.testutils.cases import TestCase


class TestGetNotificationMessageToSend(TestCase):
    def setUp(self) -> None:
        self.service = SlackService.default()

    def test_ignores_bad_activity(self) -> None:
        result = self.service._get_notification_message_to_send(activity=self.activity)
        assert result is None
