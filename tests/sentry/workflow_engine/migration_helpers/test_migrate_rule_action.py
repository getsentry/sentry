from sentry.eventstore.models import GroupEvent
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.migration_helpers.rule_action import (
    build_notification_actions_from_rule_data_actions,
)
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.typings.notification_action import (
    EXCLUDED_ACTION_DATA_KEYS,
    issue_alert_action_translator_registry,
)


class TestNotificationActionMigrationUtils(TestCase):
    def setUp(self):
        self.group = self.create_group(project=self.project)
        self.group_event = GroupEvent.from_event(self.event, self.group)

    def assert_action_data_blob(self, action: Action, compare_dict: dict):
        """
        Asserts that the action data is equivalent to the compare_dict.
        Uses the translator to determine which keys should be excluded from the data blob.
        """
        translator_class = issue_alert_action_translator_registry.get(compare_dict["id"])
        translator = translator_class()

        # Get the keys we need to ignore
        exclude_keys = [
            translator.integration_id_key,
            translator.target_identifier_key,
            translator.target_display_key,
            *EXCLUDED_ACTION_DATA_KEYS,
        ]

        # If we have a blob type, verify the data matches the blob structure
        if translator.blob_type:
            for field in translator.blob_type.__dataclass_fields__:
                assert action.data.get(field, "") == compare_dict.get(field, "")
            # Ensure no extra fields
            assert set(action.data.keys()) == {
                f.name for f in translator.blob_type.__dataclass_fields__.values()
            }
        else:
            # Assert the rest of the data is the same
            for key in compare_dict:
                if key not in exclude_keys:
                    assert compare_dict[key] == action.data[key]

            # Assert the action data blob doesn't contain more than the keys in the compare_dict
            for key in action.data:
                assert key not in exclude_keys

    def assert_action_attributes(self, action: Action, compare_dict: dict[str, str]):
        """
        Asserts that the action attributes are equivalent to the compare_dict using the translator.
        """
        translator_class = issue_alert_action_translator_registry.get(compare_dict["id"])
        translator = translator_class()

        # Assert action type matches the translator
        assert action.type == translator.action_type

        # Assert integration_id matches if specified
        if translator.integration_id_key:
            assert action.integration_id == compare_dict.get(translator.integration_id_key)

        # Assert target_identifier matches if specified
        if translator.target_identifier_key:
            assert action.target_identifier == compare_dict.get(translator.target_identifier_key)

        # Assert target_display matches if specified
        if translator.target_display_key:
            assert action.target_display == compare_dict.get(translator.target_display_key)

        # Assert target_type matches
        assert action.target_type == translator.target_type

    def assert_actions_migrated_correctly(
        self,
        actions: list[Action],
        rule_data_actions: list[dict],
    ):
        """
        Asserts that the actions are equivalent to the Rule.
        """
        assert len(actions) == len(rule_data_actions)

        for action, rule_data in zip(actions, rule_data_actions):
            assert isinstance(action, Action)
            self.assert_action_attributes(action, rule_data)
            self.assert_action_data_blob(action, rule_data)

    def test_slack_action_migration(self):
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

        self.assert_actions_migrated_correctly(actions, action_data)
