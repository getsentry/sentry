from typing import Optional

import responses

from sentry.integrations.slack.message_builder import SlackBody
from sentry.silo.base import SiloMode
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


@control_silo_test(stable=True)
class SlackCommandsHelpTest(SlackCommandsTest):
    def test_missing_command(self):
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            responses.add(
                method=responses.POST,
                url="http://testserver/extensions/slack/commands/",
                json={
                    "blocks": [
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "Here are the commands you can use. Commands not working? Re-install the app!",
                            },
                        },
                        {
                            "type": "section",
                            "text": {"type": "mrkdwn", "text": "*Direct Message Commands:*"},
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "`/sentry help`: View this list of commands.\n`/sentry link`: Link your Slack identity to your Sentry account to receive notifications. You'll also be able to perform actions in Sentry through Slack.\n`/sentry unlink`: Unlink your Slack identity from your Sentry account.",
                            },
                        },
                        {
                            "type": "section",
                            "text": {"type": "mrkdwn", "text": "*Channel Commands:*"},
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "`/sentry link team`: Get your Sentry team's issue alert notifications in the channel this command is typed in.\n`/sentry unlink team`: Unlink a team from the channel this command is typed in.",
                            },
                        },
                        {"type": "section", "text": {"type": "mrkdwn", "text": "*Contact:*"}},
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "Let us know if you have feedback: ecosystem-feedback@sentry.io",
                            },
                        },
                        {"type": "divider"},
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "Just want to learn more about Sentry? Check out our <https://docs.sentry.io/product/integrations/notification-incidents/slack/|documentation>.",
                            },
                        },
                    ]
                },
            )
        data = self.send_slack_message("")
        assert_is_help_text(data)

    @responses.activate
    def test_invalid_command(self):
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            responses.add(
                method=responses.POST,
                url="http://testserver/extensions/slack/commands/",
                json={
                    "blocks": [
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "Unknown command: `invalid command`",
                            },
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "Here are the commands you can use. Commands not working? Re-install the app!",
                            },
                        },
                        {
                            "type": "section",
                            "text": {"type": "mrkdwn", "text": "*Direct Message Commands:*"},
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "`/sentry help`: View this list of commands.\n`/sentry link`: Link your Slack identity to your Sentry account to receive notifications. You'll also be able to perform actions in Sentry through Slack.\n`/sentry unlink`: Unlink your Slack identity from your Sentry account.",
                            },
                        },
                        {
                            "type": "section",
                            "text": {"type": "mrkdwn", "text": "*Channel Commands:*"},
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "`/sentry link team`: Get your Sentry team's issue alert notifications in the channel this command is typed in.\n`/sentry unlink team`: Unlink a team from the channel this command is typed in.",
                            },
                        },
                        {"type": "section", "text": {"type": "mrkdwn", "text": "*Contact:*"}},
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "Let us know if you have feedback: ecosystem-feedback@sentry.io",
                            },
                        },
                        {"type": "divider"},
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "Just want to learn more about Sentry? Check out our <https://docs.sentry.io/product/integrations/notification-incidents/slack/|documentation>.",
                            },
                        },
                    ]
                },
            )
        data = self.send_slack_message("invalid command")
        assert_unknown_command_text(data, "invalid command")

    @responses.activate
    def test_help_command(self):
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            responses.add(
                method=responses.POST,
                url="http://testserver/extensions/slack/commands/",
                json={
                    "blocks": [
                        {
                            "text": {
                                "text": "Here are the commands you can use. Commands not "
                                "working? Re-install the app!",
                                "type": "mrkdwn",
                            },
                            "type": "section",
                        },
                        {
                            "text": {"text": "*Direct Message Commands:*", "type": "mrkdwn"},
                            "type": "section",
                        },
                        {
                            "text": {
                                "text": "`/sentry help`: View this list of commands.\n"
                                "`/sentry link`: Link your Slack identity to "
                                "your Sentry account to receive notifications. "
                                "You'll also be able to perform actions in "
                                "Sentry through Slack.\n"
                                "`/sentry unlink`: Unlink your Slack identity "
                                "from your Sentry account.",
                                "type": "mrkdwn",
                            },
                            "type": "section",
                        },
                        {
                            "text": {"text": "*Channel Commands:*", "type": "mrkdwn"},
                            "type": "section",
                        },
                        {
                            "text": {
                                "text": "`/sentry link team`: Get your Sentry team's "
                                "issue alert notifications in the channel this "
                                "command is typed in.\n"
                                "`/sentry unlink team`: Unlink a team from the "
                                "channel this command is typed in.",
                                "type": "mrkdwn",
                            },
                            "type": "section",
                        },
                        {"text": {"text": "*Contact:*", "type": "mrkdwn"}, "type": "section"},
                        {
                            "text": {
                                "text": "Let us know if you have feedback: "
                                "ecosystem-feedback@sentry.io",
                                "type": "mrkdwn",
                            },
                            "type": "section",
                        },
                        {"type": "divider"},
                        {
                            "text": {
                                "text": "Just want to learn more about Sentry? Check out "
                                "our "
                                "<https://docs.sentry.io/product/integrations/notification-incidents/slack/|documentation>.",
                                "type": "mrkdwn",
                            },
                            "type": "section",
                        },
                    ]
                },
            )
        data = self.send_slack_message("help")
        assert_is_help_text(data)
