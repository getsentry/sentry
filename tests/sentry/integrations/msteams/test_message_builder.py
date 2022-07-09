import pytest

from sentry.integrations.msteams.card_builder.base import ActionType, MSTeamsMessageBuilder
from sentry.integrations.msteams.card_builder.help import (
    MSTeamsHelpMessageBuilder,
    MSTeamsMentionedMessageBuilder,
    MSTeamsUnrecognizedCommandMessageBuilder,
)
from sentry.integrations.msteams.card_builder.identity import (
    MSTeamsAlreadyLinkedMessageBuilder,
    MSTeamsLinkCommandMessageBuilder,
    MSTeamsLinkedMessageBuilder,
    MSTeamsLinkIdentityMessageBuilder,
    MSTeamsUnlinkedMessageBuilder,
    MSTeamsUnlinkIdentityMessageBuilder,
)
from sentry.integrations.msteams.card_builder.installation import (
    MSTeamsInstallationConfirmationMessageBuilder,
    MSTeamsPersonalIntallationMessageBuilder,
    MSTeamsTeamInstallationMessageBuilder,
)
from sentry.models import Organization
from sentry.testutils import TestCase


class SimpleMessageBuilder(MSTeamsMessageBuilder):
    def build(self):
        return self._build(
            title=self.get_text_block("title"),
            text=self.get_text_block("text"),
            fields=[self.get_text_block("fields")],
            actions=[self.get_action_block(ActionType.OPEN_URL, "button", url="url")],
        )


class MissingActionParamsMessageBuilder(MSTeamsMessageBuilder):
    def build(self):
        return self._build(actions=[self.get_action_block(ActionType.OPEN_URL, "button")])


class ColumnMessageBuilder(MSTeamsMessageBuilder):
    def build(self):
        return self._build(
            text=self.get_column_set_block(
                self.get_column_block(self.get_text_block("column1")),
                self.get_column_block(self.get_text_block("column2")),
            )
        )


class MSTeamsMessageBuilderTest(TestCase):
    """
    Tests to ensure these cards can be created without errors.
    These tests do NOT test all visual aspects of the card.
    """

    def test_simple(self):
        card = SimpleMessageBuilder().build()

        assert "body" in card
        assert 3 == len(card["body"])
        assert "title" == card["body"][0]["text"]

        assert "actions" in card
        assert 1 == len(card["actions"])
        assert card["actions"][0]["type"] == ActionType.OPEN_URL
        assert card["actions"][0]["title"] == "button"

    def test_missing_action_params(self):
        with pytest.raises(KeyError):
            _ = MissingActionParamsMessageBuilder().build()

    def test_columns(self):
        card = ColumnMessageBuilder().build()

        body = card["body"]
        assert 1 == len(body)

        column_set = body[0]
        assert "ColumnSet" == column_set["type"]
        assert 2 == len(column_set)

        column = column_set["columns"][0]
        assert "Column" == column["type"]
        assert "column1" == column["items"][0]["text"]

    def test_help_messages(self):
        help_card = MSTeamsHelpMessageBuilder().build()

        assert 2 == len(help_card["body"])

        expected_avaialable_commands = ["link", "unlink", "help"]
        actual_avaialble_commands = help_card["body"][1]["text"]
        assert all(
            [command in actual_avaialble_commands for command in expected_avaialable_commands]
        )

    def test_unrecognized_command(self):
        invalid_command = "xyz"
        unrecognized_command_card = MSTeamsUnrecognizedCommandMessageBuilder(
            invalid_command
        ).build()

        assert 2 == len(unrecognized_command_card["body"])

        assert invalid_command in unrecognized_command_card["body"][0]["text"]

    def test_mentioned_message(self):
        mentioned_card = MSTeamsMentionedMessageBuilder().build()

        assert 2 == len(mentioned_card["body"])
        assert 1 == len(mentioned_card["actions"])

        assert "Docs" in mentioned_card["actions"][0]["title"]

    def test_insallation_confirmation_message(self):
        organization = Organization(name="test-org", slug="test-org")
        confirmation_card = MSTeamsInstallationConfirmationMessageBuilder(organization).build()

        assert 2 == len(confirmation_card["body"])
        assert 1 == len(confirmation_card["actions"])
        assert "test-org" in confirmation_card["body"][0]["columns"][1]["items"][0]["text"]
        assert "test-org" in confirmation_card["actions"][0]["url"]

    def test_personal_installation_message(self):
        personal_installation_card = MSTeamsPersonalIntallationMessageBuilder().build()

        assert 2 == len(personal_installation_card["body"])

    def test_team_installation_message(self):
        signed_params = "signed_params"
        team_installation_card = MSTeamsTeamInstallationMessageBuilder(signed_params).build()

        assert 3 == len(team_installation_card["body"])
        assert 1 == len(team_installation_card["actions"])
        assert "Complete Setup" in team_installation_card["actions"][0]["title"]
        assert "signed_params" in team_installation_card["actions"][0]["url"]

    def test_already_linked_message(self):
        already_linked_card = MSTeamsAlreadyLinkedMessageBuilder().build()

        assert 1 == len(already_linked_card["body"])
        assert "already linked" in already_linked_card["body"][0]["text"]

    def test_link_command_message(self):
        link_command_card = MSTeamsLinkCommandMessageBuilder().build()

        assert 1 == len(link_command_card["body"])
        assert "interact with alerts" in link_command_card["body"][0]["text"]

    def test_linked_message(self):
        linked_card = MSTeamsLinkedMessageBuilder().build()

        assert 1 == len(linked_card["body"])
        columns = linked_card["body"][0]["columns"]
        assert "Image" == columns[0]["items"][0]["type"]

    def test_link_identity_message(self):
        url = "test-url"
        link_identity_card = MSTeamsLinkIdentityMessageBuilder(url).build()

        assert 1 == len(link_identity_card["body"])
        assert 1 == len(link_identity_card["actions"])

        assert "test-url" == link_identity_card["actions"][0]["url"]

    def test_unlinked_message(self):
        unlinked_card = MSTeamsUnlinkedMessageBuilder().build()

        assert 1 == len(unlinked_card["body"])
        assert "unlinked" in unlinked_card["body"][0]["text"]

    def test_unlink_indentity_message(self):
        url = "test-url"
        unlink_identity_card = MSTeamsUnlinkIdentityMessageBuilder(url).build()

        assert 1 == len(unlink_identity_card["body"])
        assert 1 == len(unlink_identity_card["actions"])
        assert "test-url" == unlink_identity_card["actions"][0]["url"]
