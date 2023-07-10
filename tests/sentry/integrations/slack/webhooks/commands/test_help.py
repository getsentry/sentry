from typing import Optional

from sentry.integrations.slack.message_builder import SlackBody
from sentry.testutils.helpers import get_response_text
from sentry.testutils.silo import control_silo_test
from tests.sentry.integrations.slack.webhooks.commands import SlackCommandsTest


def assert_is_help_text(data: SlackBody, expected_command: Optional[str] = None) -> None:
    text = get_response_text(data)
    assert "Here are the commands you can use" in text
    if expected_command:
        assert expected_command in text


def assert_unknown_command_text(data: SlackBody, unknown_command: Optional[str] = None) -> None:
    text = get_response_text(data)
    assert f"Unknown command: `{unknown_command}`" in text
    assert "Here are the commands you can use" in text


@control_silo_test
class SlackCommandsHelpTest(SlackCommandsTest):
    def test_missing_command(self):
        data = self.send_slack_message("")
        assert_is_help_text(data)

    def test_invalid_command(self):
        data = self.send_slack_message("invalid command")
        assert_unknown_command_text(data, "invalid command")

    def test_help_command(self):
        data = self.send_slack_message("help")
        assert_is_help_text(data)
