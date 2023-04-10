import re

import pytest

from sentry.integrations.msteams.card_builder.base import MSTeamsMessageBuilder
from sentry.integrations.msteams.card_builder.block import (
    ActionType,
    ImageSize,
    TextSize,
    TextWeight,
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
    build_personal_installation_message,
    build_team_installation_confirmation_message,
    build_team_installation_message,
)
from sentry.integrations.msteams.card_builder.issues import MSTeamsIssueMessageBuilder
from sentry.integrations.msteams.card_builder.notifications import (
    MSTeamsNotificationsMessageBuilder,
)
from sentry.models import Integration, Organization, OrganizationIntegration, Rule
from sentry.models.group import GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.testutils import TestCase
from sentry.testutils.helpers.notifications import (
    DummyNotification,
    DummyNotificationWithMoreFields,
)
from sentry.utils import json


class MSTeamsMessageBuilderTest(TestCase):
    """
    Tests to ensure these cards can be created without errors.
    These tests do NOT test all visual aspects of the card.
    """

    def setUp(self):
        self.user = self.create_user(is_superuser=False)
        owner = self.create_user()
        self.org = self.create_organization(owner=owner)

        self.integration = Integration.objects.create(
            provider="msteams",
            name="Fellowship of the Ring",
            external_id="f3ll0wsh1p",
            metadata={},
        )
        OrganizationIntegration.objects.create(
            organization_id=self.org.id, integration=self.integration
        )

        self.project1 = self.create_project(organization=self.org)
        self.event1 = self.store_event(
            data={"message": "oh no"},
            project_id=self.project1.id,
        )
        self.group1 = self.event1.group

        self.rules = [
            Rule.objects.create(label="rule1", project=self.project1),
            Rule.objects.create(label="rule2", project=self.project1),
        ]

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

    def test_special_chars(self):
        card = MSTeamsMessageBuilder().build(
            text="in __init__.py ... return 1 < 2",
        )

        assert "in \\_\\_init\\_\\_.py ... return 1 &lt; 2" == card["body"][0]["text"]

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
        confirmation_card = build_team_installation_confirmation_message(organization)

        assert 2 == len(confirmation_card["body"])
        assert 1 == len(confirmation_card["actions"])
        assert "test-org" in confirmation_card["body"][0]["columns"][1]["items"][0]["text"]

        url = confirmation_card["actions"][0]["url"]
        assert "test-org" in url
        assert url.startswith("http")

    def test_personal_installation_message(self):
        signed_params = "signed_params"
        personal_installation_card = build_personal_installation_message(signed_params)

        body = personal_installation_card["body"]

        assert 3 == len(body)
        assert 1 == len(personal_installation_card["actions"])

        assert "Personal Installation of Sentry" in body[0]["columns"][1]["items"][0]["text"]

        url = personal_installation_card["actions"][0]["url"]
        assert "signed_params" in url
        assert url.startswith("http")

    def test_team_installation_message(self):
        signed_params = "signed_params"
        team_installation_card = build_team_installation_message(signed_params)

        assert 3 == len(team_installation_card["body"])
        assert (
            "Welcome to Sentry"
            in team_installation_card["body"][0]["columns"][1]["items"][0]["text"]
        )
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
        assert ImageSize.LARGE == columns[0]["items"][0]["size"]

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

    def test_issue_message_builder(self):
        self.event1.data["metadata"].update({"value": "some error"})
        self.group1.data["metadata"].update({"value": "some error"})
        self.event1.data["type"] = self.group1.data["type"] = "error"

        issue_card = MSTeamsIssueMessageBuilder(
            group=self.group1, event=self.event1, rules=self.rules, integration=self.integration
        ).build_group_card()

        body = issue_card["body"]
        assert 4 == len(body)

        title = body[0]
        assert "oh no" in title["text"]
        assert TextSize.LARGE == title["size"]
        assert TextWeight.BOLDER == title["weight"]

        description = body[1]
        assert "some error" == description["text"]
        assert TextWeight.BOLDER == description["weight"]

        footer = body[2]
        assert "ColumnSet" == footer["type"]
        assert 3 == len(footer["columns"])

        logo = footer["columns"][0]["items"][0]
        assert "20px" == logo["height"]

        issue_id_and_rule = footer["columns"][1]["items"][0]
        assert self.group1.qualified_short_id in issue_id_and_rule["text"]
        assert "rule1" in issue_id_and_rule["text"]
        assert "+1 other" in issue_id_and_rule["text"]

        date = footer["columns"][2]["items"][0]
        assert (
            re.match(
                r"""\{\{                # {{
                DATE\(                  # DATE(
                    [0-9T+:\-]+,\ SHORT #   2022-07-14T19:30:34, SHORT
                \)                      # )
                \}\}                    # }}
                \                       # whitespace
                at                      # at
                \                       # whitespace
                \{\{                    # {{
                TIME\([0-9T+:\-]+\)     # TIME(2022-07-14T19:30:34)
                \}\}                    # }}""",
                date["text"],
                re.VERBOSE,
            )
            is not None
        )

        actions_container = body[3]
        assert "Container" == actions_container["type"]

        action_set = actions_container["items"][0]
        assert "ActionSet" == action_set["type"]

        actions = action_set["actions"]
        for action in actions:
            assert ActionType.SHOW_CARD == action["type"]
            card_body = action["card"]["body"]
            assert 2 == len(card_body)
            assert "Input.ChoiceSet" == card_body[-1]["type"]

        resolve_action, ignore_action, assign_action = actions
        assert "Resolve" == resolve_action["title"]
        assert "Ignore" == ignore_action["title"]
        assert "Assign" == assign_action["title"]

        body = ignore_action["card"]["body"]
        assert 2 == len(body)
        assert "Ignore until this happens again..." == body[0]["text"]
        assert "Ignore" == ignore_action["card"]["actions"][0]["title"]

        body = assign_action["card"]["body"]
        assert 2 == len(body)
        assert "Assign to..." == body[0]["text"]
        assert "Assign" == assign_action["card"]["actions"][0]["title"]

        # Check if card is serializable to json
        card_json = json.dumps(issue_card)
        assert card_json[0] == "{" and card_json[-1] == "}"

    def test_issue_without_description(self):
        issue_card = MSTeamsIssueMessageBuilder(
            group=self.group1, event=self.event1, rules=self.rules, integration=self.integration
        ).build_group_card()

        assert 3 == len(issue_card["body"])

    def test_issue_with_only_one_rule(self):
        one_rule = self.rules[:1]
        issue_card = MSTeamsIssueMessageBuilder(
            group=self.group1, event=self.event1, rules=one_rule, integration=self.integration
        ).build_group_card()

        issue_id_and_rule = issue_card["body"][1]["columns"][1]["items"][0]

        assert "rule1" in issue_id_and_rule["text"]
        assert "+1 other" not in issue_id_and_rule["text"]

    def test_resolved_issue_message(self):
        self.group1.status = GroupStatus.RESOLVED
        self.group1.save()

        issue_card = MSTeamsIssueMessageBuilder(
            group=self.group1, event=self.event1, rules=self.rules, integration=self.integration
        ).build_group_card()

        action_set = issue_card["body"][2]["items"][0]

        resolve_action = action_set["actions"][0]
        assert ActionType.SUBMIT == resolve_action["type"]
        assert "Unresolve" == resolve_action["title"]

    def test_ignored_issue_message(self):
        self.group1.status = GroupStatus.IGNORED

        issue_card = MSTeamsIssueMessageBuilder(
            group=self.group1, event=self.event1, rules=self.rules, integration=self.integration
        ).build_group_card()

        action_set = issue_card["body"][2]["items"][0]

        ignore_action = action_set["actions"][1]
        assert ActionType.SUBMIT == ignore_action["type"]
        assert "Stop Ignoring" == ignore_action["title"]

    def test_assigned_issue_message(self):
        GroupAssignee.objects.assign(self.group1, self.user)

        issue_card = MSTeamsIssueMessageBuilder(
            group=self.group1, event=self.event1, rules=self.rules, integration=self.integration
        ).build_group_card()

        body = issue_card["body"]
        assert 4 == len(body)

        assignee_note = body[2]
        user_name = self.user.get_display_name()
        assert f"**Assigned to {user_name}**" == assignee_note["text"]

        action_set = body[3]["items"][0]

        assign_action = action_set["actions"][2]
        assert ActionType.SUBMIT == assign_action["type"]
        assert "Unassign" == assign_action["title"]


class MSTeamsNotificationMessageBuilderTest(TestCase):
    def setUp(self):
        owner = self.create_user()
        self.org = self.create_organization(owner=owner)

        self.notification = DummyNotificationWithMoreFields(self.org)
        self.project1 = self.create_project(organization=self.org)
        self.group1 = self.create_group(project=self.project1)

        self.notification.group = self.group1
        self.context = {"some_field": "some_value"}
        self.recipient = owner

    def test_simple(self):
        notification_card = MSTeamsNotificationsMessageBuilder(
            self.notification,
            self.context,
            self.recipient,
        ).build_notification_card()

        body = notification_card["body"]
        assert 4 == len(body)

        title = body[0]
        assert "Notification Title with some\\_value" == title["text"]

        group_title = body[1]
        assert "[My Title]" in group_title["text"]
        assert TextSize.LARGE == group_title["size"]
        assert TextWeight.BOLDER == group_title["weight"]

        description = body[2]
        assert "Message Description" in description["text"]
        assert TextSize.MEDIUM == description["size"]

        footer = body[3]
        assert 2 == len(footer)

        logo = footer["columns"][0]["items"][0]
        assert "Image" == logo["type"]
        assert "20px" == logo["height"]

        footer_text = footer["columns"][1]["items"][0]
        assert "Notification Footer" in footer_text["text"]
        assert TextSize.SMALL == footer_text["size"]

    def test_without_footer(self):
        dummy_notification = DummyNotification(self.org)
        dummy_notification.group = self.group1

        notification_card = MSTeamsNotificationsMessageBuilder(
            dummy_notification,
            self.context,
            self.recipient,
        ).build_notification_card()

        assert 2 == len(notification_card["body"])
