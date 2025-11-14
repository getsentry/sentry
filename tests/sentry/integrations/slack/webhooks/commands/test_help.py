from typing import int
import responses

from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.message_builder.types import SlackBody
from sentry.silo.base import SiloMode
from sentry.testutils.helpers import get_response_text
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory
from tests.sentry.integrations.slack.webhooks.commands import SlackCommandsTest


def assert_is_help_text(data: SlackBody) -> None:
    text = get_response_text(data)
    assert "Here are the commands you can use" in text


def assert_is_support_text(data: SlackBody) -> None:
    text = get_response_text(data)
    assert "Need support? Check out these resources:" in text


def assert_is_docs_text(data: SlackBody) -> None:
    text = get_response_text(data)
    assert "Want to view documentation? Check out these resources:" in text


def assert_unknown_command_text(data: SlackBody, unknown_command: str | None = None) -> None:
    text = get_response_text(data)
    assert f"Unknown command: `{unknown_command}`" in text
    assert "Here are the commands you can use" in text


@control_silo_test(regions=[Region("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT)])
class SlackCommandsHelpTest(SlackCommandsTest):
    @responses.activate
    def test_missing_command(self) -> None:
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            region_response = SlackHelpMessageBuilder(
                command=None,
                integration_id=self.integration.id,
            ).as_payload()
            responses.add(
                method=responses.POST,
                url="http://us.testserver/extensions/slack/commands/",
                json=region_response,
            )
        data = self.send_slack_message("")
        assert_is_help_text(data)

    @responses.activate
    def test_invalid_command(self) -> None:
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            region_response = SlackHelpMessageBuilder(
                command="invalid command",
                integration_id=self.integration.id,
            ).as_payload()
            responses.add(
                method=responses.POST,
                url="http://us.testserver/extensions/slack/commands/",
                json=region_response,
            )
        data = self.send_slack_message("invalid command")
        assert_unknown_command_text(data, "invalid command")

    @responses.activate
    def test_help_command_with_organization_team_linking(self) -> None:
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            region_response = SlackHelpMessageBuilder(
                command="help",
                integration_id=self.integration.id,
            ).as_payload()
            responses.add(
                method=responses.POST,
                url="http://us.testserver/extensions/slack/commands/",
                json=region_response,
            )
        data = self.send_slack_message("help")
        text = get_response_text(data)
        assert "`/sentry link team [organization_slug]`:" in text
        assert "`/sentry unlink team [organization_slug]`:" in text

    @responses.activate
    def test_support_command(self) -> None:
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            region_response = SlackHelpMessageBuilder(
                command="support",
                integration_id=self.integration.id,
            ).as_payload()
            responses.add(
                method=responses.POST,
                url="http://us.testserver/extensions/slack/commands/",
                json=region_response,
            )
        data = self.send_slack_message("support")
        assert_is_support_text(data)

    @responses.activate
    def test_docs_command(self) -> None:
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            region_response = SlackHelpMessageBuilder(
                command="docs",
                integration_id=self.integration.id,
            ).as_payload()
            responses.add(
                method=responses.POST,
                url="http://us.testserver/extensions/slack/commands/",
                json=region_response,
            )
        data = self.send_slack_message("docs")
        assert_is_docs_text(data)
