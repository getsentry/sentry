import pytest

from sentry.integrations.msteams.card_builder.base import MSTeamsMessageBuilder
from sentry.integrations.msteams.card_builder.block import (
    ActionType,
    create_action_block,
    create_column_block,
    create_column_set_block,
    create_text_block,
)
from sentry.integrations.msteams.card_builder.help import (
    build_help_command_card,
    build_mentioned_card,
    build_unrecognized_command_card,
)
from sentry.integrations.msteams.card_builder.identity import (
    build_already_linked_identity_command_card,
    build_link_identity_command_card,
    build_linked_card,
    build_linking_card,
    build_unlink_identity_card,
    build_unlinked_card,
)
from sentry.integrations.msteams.card_builder.installation import (
    build_installation_confirmation_message,
    build_personal_installation_message,
    build_welcome_card,
)
from sentry.models import Organization
from sentry.testutils import TestCase


class MSTeamsMessageBuilderTest(TestCase):
    """
    Tests to ensure these cards can be created without errors.
    These tests do NOT test all visual aspects of the card.
    """

    def test_simple(self):
        card = MSTeamsMessageBuilder().build(
            title=create_text_block("title"),
            text="text",
            fields=[create_text_block("fields")],
            actions=[create_action_block(ActionType.OPEN_URL, "button", url="url")],
        )

        assert "body" in card
        assert 3 == len(card["body"])
        assert "title" == card["body"][0]["text"]

        assert "actions" in card
        assert 1 == len(card["actions"])
        assert card["actions"][0]["type"] == ActionType.OPEN_URL
        assert card["actions"][0]["title"] == "button"

    def test_missing_action_params(self):
        with pytest.raises(KeyError):
            _ = MSTeamsMessageBuilder().build(
                actions=[create_action_block(ActionType.OPEN_URL, "button")]
            )

    def test_columns(self):
        card = MSTeamsMessageBuilder().build(
            text=create_column_set_block(
                "column1",
                create_column_block(create_text_block("column2")),
            )
        )

        body = card["body"]
        assert 1 == len(body)

        column_set = body[0]
        assert "ColumnSet" == column_set["type"]
        assert 2 == len(column_set)

        column = column_set["columns"][0]
        assert "Column" == column["type"]
        assert "column1" == column["items"][0]["text"]

    def test_help_messages(self):
        help_card = build_help_command_card()

        assert 2 == len(help_card["body"])

        expected_avaialable_commands = ["link", "unlink", "help"]
        actual_avaialble_commands = help_card["body"][1]["text"]
        assert all(
            [command in actual_avaialble_commands for command in expected_avaialable_commands]
        )

    def test_unrecognized_command(self):
        invalid_command = "xyz"
        unrecognized_command_card = build_unrecognized_command_card(invalid_command)

        assert 2 == len(unrecognized_command_card["body"])

        assert invalid_command in unrecognized_command_card["body"][0]["text"]

    def test_mentioned_message(self):
        mentioned_card = build_mentioned_card()

        assert 2 == len(mentioned_card["body"])
        assert 1 == len(mentioned_card["actions"])

        assert "Docs" in mentioned_card["actions"][0]["title"]

    def test_insallation_confirmation_message(self):
        organization = Organization(name="test-org", slug="test-org")
        confirmation_card = build_installation_confirmation_message(organization)

        assert 2 == len(confirmation_card["body"])
        assert 1 == len(confirmation_card["actions"])
        assert "test-org" in confirmation_card["body"][0]["columns"][1]["items"][0]["text"]

        url = confirmation_card["actions"][0]["url"]
        assert "test-org" in url
        assert url.startswith("http")

    def test_personal_installation_message(self):
        personal_installation_card = build_personal_installation_message()

        assert 2 == len(personal_installation_card["body"])

    def test_team_installation_message(self):
        signed_params = "signed_params"
        team_installation_card = build_welcome_card(signed_params)

        assert 3 == len(team_installation_card["body"])
        assert 1 == len(team_installation_card["actions"])
        assert "Complete Setup" in team_installation_card["actions"][0]["title"]

        url = team_installation_card["actions"][0]["url"]
        assert "signed_params" in url
        assert url.startswith("http")

    def test_already_linked_message(self):
        already_linked_card = build_already_linked_identity_command_card()

        assert 1 == len(already_linked_card["body"])
        assert "already linked" in already_linked_card["body"][0]["text"]

    def test_link_command_message(self):
        link_command_card = build_link_identity_command_card()

        assert 1 == len(link_command_card["body"])
        assert "interact with alerts" in link_command_card["body"][0]["text"]

    def test_linked_message(self):
        linked_card = build_linked_card()

        assert 1 == len(linked_card["body"])
        columns = linked_card["body"][0]["columns"]
        assert "Image" == columns[0]["items"][0]["type"]

    def test_link_identity_message(self):
        url = "test-url"
        link_identity_card = build_linking_card(url)

        assert 1 == len(link_identity_card["body"])
        assert 1 == len(link_identity_card["actions"])

        assert "test-url" == link_identity_card["actions"][0]["url"]

    def test_unlinked_message(self):
        unlinked_card = build_unlinked_card()

        assert 1 == len(unlinked_card["body"])
        assert "unlinked" in unlinked_card["body"][0]["text"]

    def test_unlink_indentity_message(self):
        url = "test-url"
        unlink_identity_card = build_unlink_identity_card(url)

        assert 1 == len(unlink_identity_card["body"])
        assert 1 == len(unlink_identity_card["actions"])
        assert "test-url" == unlink_identity_card["actions"][0]["url"]
