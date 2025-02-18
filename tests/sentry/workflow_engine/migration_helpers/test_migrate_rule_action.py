from typing import Any
from unittest.mock import patch

import pytest

from sentry.eventstore.models import GroupEvent
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.data_blobs import (
    AZURE_DEVOPS_ACTION_DATA_BLOBS,
    EMAIL_ACTION_DATA_BLOBS,
    GITHUB_ACTION_DATA_BLOBS,
    JIRA_ACTION_DATA_BLOBS,
    JIRA_SERVER_ACTION_DATA_BLOBS,
    WEBHOOK_ACTION_DATA_BLOBS,
)
from sentry.workflow_engine.migration_helpers.rule_action import (
    build_notification_actions_from_rule_data_actions,
)
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.typings.notification_action import (
    EXCLUDED_ACTION_DATA_KEYS,
    TicketDataBlob,
    TicketFieldMappingKeys,
    issue_alert_action_translator_registry,
)


class TestNotificationActionMigrationUtils(TestCase):
    def setUp(self):
        self.group = self.create_group(project=self.project)
        self.group_event = GroupEvent.from_event(self.event, self.group)

    def assert_ticketing_action_data_blob(
        self, action: Action, compare_dict: dict, exclude_keys: list[str]
    ):

        # Check dynamic_form_fields
        assert action.data.get(
            TicketFieldMappingKeys.DYNAMIC_FORM_FIELDS_KEY.value, {}
        ) == compare_dict.get(TicketFieldMappingKeys.DYNAMIC_FORM_FIELDS_KEY.value, {})

        # Check that additional_fields contains all other non-excluded fields
        additional_fields = action.data.get(TicketFieldMappingKeys.ADDITIONAL_FIELDS_KEY.value, {})
        for key, value in compare_dict.items():
            if (
                key not in exclude_keys
                and key not in TicketFieldMappingKeys.DYNAMIC_FORM_FIELDS_KEY.value
                and key != "id"
            ):
                assert additional_fields.get(key) == value

    def assert_action_data_blob(
        self,
        action: Action,
        compare_dict: dict,
        integration_id_key: str | None = None,
        target_identifier_key: str | None = None,
        target_display_key: str | None = None,
        target_type_key: str | None = None,
    ):
        """
        Asserts that the action data is equivalent to the compare_dict.
        Uses the translator to determine which keys should be excluded from the data blob.
        """
        translator_class = issue_alert_action_translator_registry.get(compare_dict["id"])
        translator = translator_class(compare_dict)

        # Get the keys we need to ignore
        exclude_keys = [*EXCLUDED_ACTION_DATA_KEYS]
        if integration_id_key:
            exclude_keys.append(integration_id_key)
        if target_identifier_key:
            exclude_keys.append(target_identifier_key)
        if target_display_key:
            exclude_keys.append(target_display_key)
        if target_type_key:
            exclude_keys.append(target_type_key)

        # If we have a blob type, verify the data matches the blob structure
        if translator.blob_type:
            # Special handling for TicketDataBlob which has additional_fields
            if translator.blob_type == TicketDataBlob:
                self.assert_ticketing_action_data_blob(action, compare_dict, exclude_keys)
            else:
                # Original logic for other blob types
                for field in translator.blob_type.__dataclass_fields__:
                    mapping = translator.field_mappings.get(field)
                    if mapping:
                        # For mapped fields, check against the source field with default value
                        source_value = compare_dict.get(mapping.source_field, mapping.default_value)
                        assert action.data.get(field) == source_value
                    else:
                        # For unmapped fields, check directly with empty string default
                        if action.type == Action.Type.EMAIL and field == "fallthroughType":
                            # for email actions, the default value for fallthroughType should be "ActiveMembers"
                            assert action.data.get(field) == compare_dict.get(
                                field, "ActiveMembers"
                            )
                        else:
                            assert action.data.get(field) == compare_dict.get(field, "")
                # Ensure no extra fields
                assert set(action.data.keys()) == {
                    f.name for f in translator.blob_type.__dataclass_fields__.values()
                }
        else:
            # Assert the rest of the data is the same
            for key in compare_dict:
                if key not in exclude_keys:
                    if (
                        action.type == Action.Type.EMAIL
                        and key == "fallthroughType"
                        and action.target_type != ActionTarget.ISSUE_OWNERS
                    ):
                        # for email actions, fallthroughType should only be set for when targetType is ISSUE_OWNERS
                        continue
                    else:
                        assert compare_dict[key] == action.data[key]

            # Assert the action data blob doesn't contain more than the keys in the compare_dict
            for key in action.data:
                assert key not in exclude_keys

    def assert_action_attributes(
        self,
        action: Action,
        compare_dict: dict[str, str],
        integration_id_key: str | None = None,
        target_identifier_key: str | None = None,
        target_display_key: str | None = None,
    ):
        """
        Asserts that the action attributes are equivalent to the compare_dict using the translator.
        """
        translator_class = issue_alert_action_translator_registry.get(compare_dict["id"])
        translator = translator_class(compare_dict)

        # Assert action type matches the translator
        assert action.type == translator.action_type

        # Assert integration_id matches if specified
        if integration_id_key:
            assert action.integration_id == compare_dict.get(integration_id_key)

        # Assert target_identifier matches if specified
        if target_identifier_key:
            compare_val = compare_dict.get(target_identifier_key)
            # Handle both "None" string and None value
            if compare_val in ["None", None, ""]:
                assert action.target_identifier is None
            else:
                assert action.target_identifier == compare_val

        # Assert target_display matches if specified
        if target_display_key:
            assert action.target_display == compare_dict.get(target_display_key)

        # Assert target_type matches
        assert action.target_type == translator.target_type

    def assert_actions_migrated_correctly(
        self,
        actions: list[Action],
        rule_data_actions: list[dict],
        integration_id_key: str | None = None,
        target_identifier_key: str | None = None,
        target_display_key: str | None = None,
        target_type_key: str | None = None,
    ):
        """
        Asserts that the actions are equivalent to the Rule.
        """

        for action, rule_data in zip(actions, rule_data_actions):
            assert isinstance(action, Action)
            self.assert_action_attributes(
                action,
                rule_data,
                integration_id_key,
                target_identifier_key,
                target_display_key,
            )
            self.assert_action_data_blob(
                action,
                rule_data,
                integration_id_key,
                target_identifier_key,
                target_display_key,
                target_type_key,
            )

    @patch("sentry.workflow_engine.migration_helpers.rule_action.logger.error")
    def test_missing_id_in_action_data(self, mock_logger):
        action_data = [
            {
                "workspace": "1",
                "channel": "#bufo-bot",
                "notes": "@bufo",
                "tags": "level,environment,os",
                "uuid": "b1234567-89ab-cdef-0123-456789abcdef",
                "channel_id": "C01234567890",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

        # Assert the logger was called with the correct arguments
        mock_logger.assert_called_with(
            "No registry ID found for action",
            extra={"action_uuid": "b1234567-89ab-cdef-0123-456789abcdef"},
        )

    @patch("sentry.workflow_engine.migration_helpers.rule_action.logger.exception")
    def test_unregistered_action_translator(self, mock_logger):
        action_data = [
            {
                "workspace": "1",
                "id": "sentry.integrations.slack.notify_action.FakeAction",
                "uuid": "b1234567-89ab-cdef-0123-456789abcdef",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

        # Assert the logger was called with the correct arguments
        mock_logger.assert_called_with(
            "Action translator not found for action",
            extra={
                "registry_id": "sentry.integrations.slack.notify_action.FakeAction",
                "action_uuid": "b1234567-89ab-cdef-0123-456789abcdef",
            },
        )

    def test_slack_action_migration_simple(self):
        action_data = [
            {
                "workspace": "1",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "channel": "#bufo-bot",
                "notes": "@bufo",
                "tags": "level,environment,os",
                "uuid": "b1234567-89ab-cdef-0123-456789abcdef",
                "channel_id": "C01234567890",
            },
            {
                "workspace": "2",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "channel": "#bufo-bot-is-cool",
                "tags": "#ALERT-BUFO",
                "channel_id": "C01234567890",
                "uuid": "f1234567-89ab-cdef-0123-456789abcdef",
            },
            {
                "workspace": "3",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "channel": "sentry-bufo-bot",
                "channel_id": "C1234567890",
                "tags": "",
                "uuid": "g1234567-89ab-cdef-0123-456789abcdef",
            },
            {
                "workspace": "4",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "channel": "#proj-bufo-bot",
                "notes": "@bufo-are-cool",
                "channel_id": "C01234567890",
                "tags": "",
                "uuid": "h1234567-89ab-cdef-0123-456789abcdef",
            },
            {
                "workspace": "5",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "channel": "sentry-bufo-bot",
                "notes": "@bufo-are-cool",
                "channel_id": "C01234567890",
                "uuid": "i1234567-89ab-cdef-0123-456789abcdef",
            },
        ]

        actions = build_notification_actions_from_rule_data_actions(action_data)
        assert len(actions) == len(action_data)

        self.assert_actions_migrated_correctly(
            actions, action_data, "workspace", "channel_id", "channel"
        )

    @patch("sentry.workflow_engine.migration_helpers.rule_action.logger.error")
    def test_slack_action_migration_malformed(self, mock_logger):
        action_data = [
            # Missing required fields
            {
                "workspace": "1",
                "uuid": "b1234567-89ab-cdef-0123-456789abcdef",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
            },
            {
                "workspace": "1",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "channel": "#bufo-bot",
                "notes": "@bufo",
                "tags": "level,environment,os",
                "uuid": "b1234567-89ab-cdef-0123-456789abcdef",
                "channel_id": "C01234567890",
            },
            {
                "workspace": "2",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "channel": "#bufo-bot-is-cool",
                "tags": "#ALERT-BUFO",
                "channel_id": "C01234567890",
                "uuid": "f1234567-89ab-cdef-0123-456789abcdef",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

        # Assert the logger was called with the correct arguments
        mock_logger.assert_called_with(
            "Action blob is malformed: missing required fields",
            extra={
                "registry_id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "action_uuid": "b1234567-89ab-cdef-0123-456789abcdef",
                "missing_fields": ["channel_id", "channel"],
            },
        )

    def test_discord_action_migration(self):
        action_data = [
            {
                "server": "1",
                "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                "channel_id": "1112223334445556677",
                "tags": "environment",
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
            },
            {
                "server": "2",
                "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                "channel_id": "99988877766555444333",
                "tags": "",
                "uuid": "22345678-90ab-cdef-0123-456789abcdef",
            },
        ]

        actions = build_notification_actions_from_rule_data_actions(action_data)

        self.assert_actions_migrated_correctly(actions, action_data, "server", "channel_id", None)

    @patch("sentry.workflow_engine.migration_helpers.rule_action.logger.error")
    def test_discord_action_migration_malformed(self, mock_logger):
        action_data = [
            # Missing required fields
            {
                "server": "1",
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
            },
            {
                "server": "1",
                "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                "channel_id": "1112223334445556677",
                "tags": "environment",
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

        # Assert the logger was called with the correct arguments
        mock_logger.assert_called_with(
            "Action blob is malformed: missing required fields",
            extra={
                "registry_id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                "action_uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "missing_fields": ["channel_id"],
            },
        )

    def test_msteams_action_migration(self):
        action_data = [
            # MsTeams Action will  always include, channel and channel_id
            # It won't store anything in the data blob
            {
                "team": "12345",
                "id": "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
                "channel": "Bufo",
                "channel_id": "1:hksdhfdskfhsdfdhsk@thread.tacv2",
                "uuid": "10987654-3210-9876-5432-109876543210",
            },
            {
                "team": "230405",
                "id": "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
                "channel": "Sentry FE Non-Prod",
                "channel_id": "19:c3c894b8d4194fb1aa7f89da84bfcd69@thread.tacv2",
                "uuid": "4777a764-11fd-418c-b61b-533767424425",
            },
        ]

        actions = build_notification_actions_from_rule_data_actions(action_data)

        self.assert_actions_migrated_correctly(
            actions, action_data, "team", "channel_id", "channel"
        )

    @patch("sentry.workflow_engine.migration_helpers.rule_action.logger.error")
    def test_msteams_action_migration_malformed(self, mock_logger):
        action_data = [
            # Missing required fields
            {
                "team": "1",
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "id": "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
            },
            {
                "team": "1",
                "id": "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
                "channel": "Bufo",
                "channel_id": "1:hksdhfdskfhsdfdhsk@thread.tacv2",
                "uuid": "10987654-3210-9876-5432-109876543210",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

        # Assert the logger was called with the correct arguments
        mock_logger.assert_called_with(
            "Action blob is malformed: missing required fields",
            extra={
                "registry_id": "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
                "action_uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "missing_fields": ["channel_id", "channel"],
            },
        )

    def test_pagerduty_action_migration(self):
        action_data = [
            {
                "account": "123456",
                "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
                "service": "91919",
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
            },
            {
                "account": "999999",
                "service": "19191",
                "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
                "uuid": "9a8b7c6d-5e4f-3a2b-1c0d-9a8b7c6d5e4f",
                "severity": "warning",
            },
            {
                "account": "77777",
                "service": "57436",
                "severity": "info",
                "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
            },
        ]

        actions = build_notification_actions_from_rule_data_actions(action_data)
        assert len(actions) == len(action_data)

        # Verify that default value is used when severity is not provided
        assert actions[0].data["priority"] == "default"
        # Verify that severity is mapped to priority
        assert actions[1].data["priority"] == "warning"
        assert actions[2].data["priority"] == "info"

        self.assert_actions_migrated_correctly(actions, action_data, "account", "service", None)

    def test_pagerduty_action_migration_malformed(self):
        action_data = [
            # Missing required fields
            {
                "account": "123456",
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
            },
            {
                "account": "123456",
                "service": "91919",
                "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

    def test_opsgenie_action_migration(self):
        action_data = [
            {
                "account": "11111",
                "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                "team": "2323213-bbbbbuuufffooobottt",
                "uuid": "87654321-0987-6543-2109-876543210987",
            },
            {
                "account": "123456",
                "team": "1234-bufo-bot",
                "priority": "P2",
                "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
            },
            {
                "account": "999999",
                "team": "1234-bufo-bot-2",
                "priority": "P3",
                "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                "uuid": "01234567-89ab-cdef-0123-456789abcdef",
            },
        ]

        actions = build_notification_actions_from_rule_data_actions(action_data)
        assert len(actions) == len(action_data)

        # Verify that default value is used when priority is not provided
        assert actions[0].data["priority"] == "P3"
        # Verify that priority is mapped to priority
        assert actions[1].data["priority"] == "P2"
        assert actions[2].data["priority"] == "P3"

        self.assert_actions_migrated_correctly(actions, action_data, "account", "team", None)

    def test_opsgenie_action_migration_malformed(self):
        action_data = [
            # Missing required fields
            {
                "account": "123456",
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
            },
            {
                "account": "123456",
                "team": "1234-bufo-bot",
                "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

    def test_github_action_migration(self):
        # Includes both, Github and Github Enterprise. We currently don't have any rules configured for Github Enterprise.
        # The Github Enterprise action should have the same shape as the Github action.
        action_data = GITHUB_ACTION_DATA_BLOBS

        actions = build_notification_actions_from_rule_data_actions(action_data)

        self.assert_actions_migrated_correctly(actions, action_data, "integration", None, None)

    def test_github_action_migration_malformed(self):
        action_data = [
            # Missing required fields
            {
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "id": "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

    def test_azure_devops_migration(self):
        action_data = AZURE_DEVOPS_ACTION_DATA_BLOBS
        actions = build_notification_actions_from_rule_data_actions(action_data)
        self.assert_actions_migrated_correctly(actions, action_data, "integration", None, None)

    def test_azure_devops_migration_malformed(self):
        action_data = [
            # Missing required fields
            {
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "id": "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

    def test_email_migration(self):
        action_data = EMAIL_ACTION_DATA_BLOBS

        actions = build_notification_actions_from_rule_data_actions(action_data)
        self.assert_actions_migrated_correctly(
            actions, action_data, None, "targetIdentifier", None, "targetType"
        )

    def test_email_migration_malformed(self):
        action_data = [
            {
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "id": "sentry.mail.actions.NotifyEmailAction",
            },
            # This should also fail since we don't have a default value for targetType
            {
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "fallthroughType": "NoOne",
            },
            # This should be ok since we have a default value for fallthroughType
            {
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetType": "IssueOwners",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

    def test_plugin_action_migration(self):
        action_data = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "uuid": "c792d184-81db-419f-8ab2-83baef1216f4",
            },
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "uuid": "0202a169-326b-4575-8887-afe69cc58040",
            },
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "uuid": "ad671f12-6bb7-4b9d-a4fe-f32e985fe08e",
            },
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "uuid": "efe1841d-d33a-460a-8d65-7697893ec7f1",
            },
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "uuid": "8c0c2fc9-5d89-4974-9d3c-31b1d602a065",
            },
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "uuid": "e63c387c-94f4-4284-bef8-c08b218654a3",
            },
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "uuid": "0269d028-9466-4826-8ab9-18cd47fb08d2",
            },
        ]

        actions = build_notification_actions_from_rule_data_actions(action_data)
        self.assert_actions_migrated_correctly(actions, action_data, None, None, None)

    def test_webhook_action_migration(self):
        action_data = WEBHOOK_ACTION_DATA_BLOBS
        actions = build_notification_actions_from_rule_data_actions(action_data)
        self.assert_actions_migrated_correctly(actions, action_data, None, "service", None)

    def test_webhook_action_migration_to_sentry_app(self):
        app = self.create_sentry_app(
            organization=self.organization,
            name="Test Application",
            is_alertable=True,
        )

        action_data = [
            {
                "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                "service": app.slug,
            },
        ]

        actions = build_notification_actions_from_rule_data_actions(action_data)
        assert len(actions) == 1
        assert actions[0].type == Action.Type.SENTRY_APP
        assert actions[0].target_identifier == str(app.id)
        assert actions[0].target_type == ActionTarget.SENTRY_APP
        assert actions[0].data == {}

    def test_webhook_action_migration_malformed(self):
        action_data = [
            {
                "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

    def test_action_types(self):
        """Test that all registered action translators have the correct action type set."""
        test_cases = [
            (
                "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                Action.Type.SLACK,
            ),
            (
                "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                Action.Type.DISCORD,
            ),
            (
                "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
                Action.Type.MSTEAMS,
            ),
            (
                "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
                Action.Type.PAGERDUTY,
            ),
            (
                "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                Action.Type.OPSGENIE,
            ),
            (
                "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
                Action.Type.GITHUB,
            ),
            (
                "sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction",
                Action.Type.GITHUB_ENTERPRISE,
            ),
            (
                "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
                Action.Type.AZURE_DEVOPS,
            ),
            (
                "sentry.mail.actions.NotifyEmailAction",
                Action.Type.EMAIL,
            ),
            (
                "sentry.rules.actions.notify_event.NotifyEventAction",
                Action.Type.PLUGIN,
            ),
            (
                "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                Action.Type.WEBHOOK,
            ),
        ]

        for registry_id, expected_type in test_cases:
            translator_class = issue_alert_action_translator_registry.get(registry_id)
            # Create an instance with empty action data
            translator = translator_class({"id": registry_id})
            assert translator.action_type == expected_type, (
                f"Action translator {registry_id} has incorrect action type. "
                f"Expected {expected_type}, got {translator.action_type}"
            )

    def test_action_type_in_migration(self):
        """Test that action types are correctly set during migration."""
        test_cases = [
            # Slack
            (
                {
                    "workspace": "1",
                    "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                    "channel": "#test",
                    "channel_id": "C123",
                    "uuid": "test-uuid",
                },
                Action.Type.SLACK,
            ),
            # Discord
            (
                {
                    "server": "1",
                    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                    "channel_id": "123",
                    "uuid": "test-uuid",
                },
                Action.Type.DISCORD,
            ),
            # MS Teams
            (
                {
                    "team": "1",
                    "id": "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
                    "channel": "test",
                    "channel_id": "123",
                    "uuid": "test-uuid",
                },
                Action.Type.MSTEAMS,
            ),
            # PagerDuty
            (
                {
                    "account": "1",
                    "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
                    "service": "123",
                    "uuid": "test-uuid",
                },
                Action.Type.PAGERDUTY,
            ),
            # Opsgenie
            (
                {
                    "account": "1",
                    "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                    "team": "123",
                    "uuid": "test-uuid",
                },
                Action.Type.OPSGENIE,
            ),
            # GitHub
            (
                {
                    "integration": "1",
                    "id": "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
                    "uuid": "test-uuid",
                },
                Action.Type.GITHUB,
            ),
            # GitHub Enterprise
            (
                {
                    "integration": "1",
                    "id": "sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction",
                    "uuid": "test-uuid",
                },
                Action.Type.GITHUB_ENTERPRISE,
            ),
            # Azure DevOps
            (
                {
                    "integration": "1",
                    "id": "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
                    "uuid": "test-uuid",
                },
                Action.Type.AZURE_DEVOPS,
            ),
            # Email
            (
                {
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "uuid": "test-uuid",
                    "targetType": "IssueOwners",
                },
                Action.Type.EMAIL,
            ),
            # Plugin
            (
                {
                    "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                    "uuid": "test-uuid",
                },
                Action.Type.PLUGIN,
            ),
            # Webhook
            (
                {
                    "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                    "service": "webhooks",
                    "uuid": "test-uuid",
                },
                Action.Type.WEBHOOK,
            ),
        ]

        for action_data, expected_type in test_cases:
            actions = build_notification_actions_from_rule_data_actions([action_data])
            assert len(actions) == 1
            assert actions[0].type == expected_type, (
                f"Action {action_data['id']} has incorrect type after migration. "
                f"Expected {expected_type}, got {actions[0].type}"
            )

    def test_jira_action_migration(self):
        action_data = JIRA_ACTION_DATA_BLOBS
        actions = build_notification_actions_from_rule_data_actions(action_data)
        self.assert_actions_migrated_correctly(actions, action_data, "integration", None, None)

    def test_jira_action_migration_malformed(self):
        action_data: list[dict[str, Any]] = [
            # Missing required fields
            {
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
            },
            # Empty additional fields
            {
                "integration": "12345",
                "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
                "project": "10001",
                "issuetype": "10001",
                "reporter": "user123",
                "uuid": "11111111-1111-1111-1111-111111111111",
                "customfield_10253": "",
                "customfield_10285": [],
                "customfield_10290": "",
                "customfield_10301": "",
                "customfield_10315": "",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

    def test_jira_server_action_migration(self):
        action_data = JIRA_SERVER_ACTION_DATA_BLOBS
        actions = build_notification_actions_from_rule_data_actions(action_data)
        self.assert_actions_migrated_correctly(actions, action_data, "integration", None, None)

    def test_jira_server_action_migration_malformed(self):
        action_data: list[dict[str, Any]] = [
            # Missing required fields
            {
                "uuid": "12345678-90ab-cdef-0123-456789abcdef",
                "id": "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
            },
            # Empty additional fields
            {
                "integration": "123456",
                "id": "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
                "project": "10001",
                "issuetype": "1",
                "reporter": "user123",
                "uuid": "11111111-1111-1111-1111-111111111111",
                "priority": "",
                "components": [],
                "fixVersions": [],
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)

    def test_sentry_app_action_migration(self):
        app = self.create_sentry_app(
            organization=self.organization,
            name="Test Application",
            is_alertable=True,
        )

        install = self.create_sentry_app_installation(
            slug="test-application", organization=self.organization
        )

        action_data = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "sentryAppInstallationUuid": install.uuid,
                "settings": [
                    {
                        "name": "opsgenieResponders",
                        "value": '[{ "id": "8132bcc6-e697-44b2-8b61-c044803f9e6e", "type": "team" }]',
                    },
                    {
                        "name": "tagsToInclude",
                        "value": "environment",
                    },
                    {"name": "opsgeniePriority", "value": "P2"},
                ],
                "hasSchemaFormConfig": True,
                "formFields": {
                    "type": "alert-rule-settings",
                    "uri": "/sentry/alert-rule-integration",
                    "required_fields": [
                        {
                            "name": "opsgenieResponders",
                            "label": "Opsgenie Responders",
                            "type": "textarea",
                        }
                    ],
                    "optional_fields": [
                        {"name": "tagsToInclude", "label": "Tags to include", "type": "text"},
                        {
                            "name": "opsgeniePriority",
                            "label": "Opsgenie Alert Priority",
                            "type": "select",
                            "options": [
                                ["P1", "P1"],
                                ["P2", "P2"],
                                ["P3", "P3"],
                                ["P4", "P4"],
                                ["P5", "P5"],
                            ],
                            "choices": [
                                ["P1", "P1"],
                                ["P2", "P2"],
                                ["P3", "P3"],
                                ["P4", "P4"],
                                ["P5", "P5"],
                            ],
                        },
                    ],
                },
                "uuid": "55429e64-ce1a-46d5-bdff-e3f2fdf415b1",
                "_sentry_app": [
                    ["id", 1],
                    ["scope_list", ["event:read"]],
                    ["application_id", 1],
                    [
                        "application",
                        [
                            ["id", 1],
                        ],
                    ],
                ],
            },
            # Simple webhook sentry app
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "sentryAppInstallationUuid": install.uuid,
                "settings": [
                    {"name": "destination", "value": "slack"},
                    {"name": "systemid", "value": "test-system"},
                ],
                "hasSchemaFormConfig": True,
                "uuid": "a37dd837-d709-4d67-9442-b23d068a5b43",
            },
            # Custom webhook sentry app with team selection
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "sentryAppInstallationUuid": install.uuid,
                "settings": [
                    {"name": "team", "value": "team-a"},
                    {"name": "severity", "value": "sev2"},
                ],
                "hasSchemaFormConfig": True,
                "uuid": "5b6d5bba-b3ba-40d5-b3e0-9b5f567ad277",
                "formFields": {
                    "type": "alert-rule-settings",
                    "uri": "/v1/ticket",
                    "required_fields": [
                        {
                            "type": "select",
                            "label": "Team",
                            "name": "team",
                            "options": [
                                ["unknown", "Automatic"],
                                ["team-a", "Team A"],
                                ["team-b", "Team B"],
                            ],
                            "choices": [
                                ["unknown", "Automatic"],
                                ["team-a", "Team A"],
                                ["team-b", "Team B"],
                            ],
                        },
                        {
                            "type": "select",
                            "label": "Severity",
                            "name": "severity",
                            "options": [
                                ["sev1", "Severity 1"],
                                ["sev2", "Severity 2"],
                                ["sev3", "Severity 3"],
                            ],
                            "choices": [
                                ["sev1", "Severity 1"],
                                ["sev2", "Severity 2"],
                                ["sev3", "Severity 3"],
                            ],
                        },
                    ],
                },
            },
        ]

        actions = build_notification_actions_from_rule_data_actions(action_data)
        assert len(actions) == len(action_data)
        self.assert_actions_migrated_correctly(actions, action_data, None, None, None)

        # Verify that action type is set correctly
        for action in actions:
            assert action.type == Action.Type.SENTRY_APP
            assert action.target_identifier == str(app.id)

    def test_sentry_app_migration_with_form_config(self):
        action_data = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "sentryAppInstallationUuid": "fake-uuid",
                "settings": [
                    {"name": "destination", "value": "slack"},
                    {"name": "systemid", "value": "test-system"},
                ],
                "hasSchemaFormConfig": True,
                "uuid": "a37dd837-d709-4d67-9442-b23d068a5b43",
            },
        ]

        with pytest.raises(ValueError):
            build_notification_actions_from_rule_data_actions(action_data)
