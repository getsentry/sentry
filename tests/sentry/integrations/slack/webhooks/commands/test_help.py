from typing import Optional

import responses

from fixtures.slack import HELP_COMMAND, INVALID_COMMAND, MISSING_COMMAND
from sentry.integrations.slack.message_builder import SlackBody
from sentry.silo.base import SiloMode
from sentry.testutils.helpers import get_response_text
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory
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


@control_silo_test(regions=[Region("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT)])
class SlackCommandsHelpTest(SlackCommandsTest):
    @responses.activate
    def test_missing_command(self):
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            responses.add(
                method=responses.POST,
                url="http://us.testserver/extensions/slack/commands/",
                json=MISSING_COMMAND,
            )
        data = self.send_slack_message("")
        assert_is_help_text(data)

    @responses.activate
    def test_invalid_command(self):
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            responses.add(
                method=responses.POST,
                url="http://us.testserver/extensions/slack/commands/",
                json=INVALID_COMMAND,
            )
        data = self.send_slack_message("invalid command")
        assert_unknown_command_text(data, "invalid command")

    @responses.activate
    def test_help_command(self):
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            responses.add(
                method=responses.POST,
                url="http://us.testserver/extensions/slack/commands/",
                json=HELP_COMMAND,
            )
        data = self.send_slack_message("help")
        assert_is_help_text(data)
