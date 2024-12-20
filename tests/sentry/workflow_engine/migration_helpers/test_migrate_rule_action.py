from sentry.models.group import GroupEvent
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.migration_helpers.rule_action import (
    build_notification_actions_from_rule_data_actions,
)
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.typings.notification_action import (
    ACTION_TYPE_2_INTEGRATION_ID_KEY,
    ACTION_TYPE_2_TARGET_DISPLAY_KEY,
    ACTION_TYPE_2_TARGET_IDENTIFIER_KEY,
    EXCLUDED_ACTION_DATA_KEYS,
    RULE_REGISTRY_ID_2_INTEGRATION_PROVIDER,
)


class TestNotificationActionMigrationUtils(TestCase):
    """
    Tests for the migration utils for notification actions.
    """

    def setUp(self):
        self.group = self.create_group(project=self.project)
        self.group_event = GroupEvent.from_event(self.event, self.group)

    def assert_action_data_blob(self, action: Action, compare_dict: dict):
        """
        Asserts that the action data is equivalent to the compare_dict.
        The keys in the compare_dict that are not in the EXCLUDED_ACTION_DATA_KEYS are compared.
        The data blob shouldn't contain more than the keys in the compare_dict.
        """

        # Get the keys we need to ignore
        exclude_keys = [
            ACTION_TYPE_2_INTEGRATION_ID_KEY.get(action.type),
            ACTION_TYPE_2_TARGET_IDENTIFIER_KEY.get(action.type),
            ACTION_TYPE_2_TARGET_DISPLAY_KEY.get(action.type),
            *EXCLUDED_ACTION_DATA_KEYS,
        ]

        # Assert the rest of the data is the same
        for key in compare_dict:
            if key not in exclude_keys:
                assert compare_dict[key] == action.data[key]

        # Assert the action data blob doesn't contain more than the keys in the compare_dict
        for key in action.data:
            assert key not in exclude_keys

    def assert_action_attributes(
        self, action: Action, compare_dict: dict[str, str], target_type: ActionTarget
    ):
        """
        Asserts that the action attributes are equivalent to the compare_dict.
        """
        # action_type
        id = compare_dict.get("id")
        assert action.type == RULE_REGISTRY_ID_2_INTEGRATION_PROVIDER.get(id)

        # target_type
        assert action.target_type == target_type

        if target_type == ActionTarget.SPECIFIC:
            # integration_id
            assert action.integration_id == compare_dict.get(
                ACTION_TYPE_2_INTEGRATION_ID_KEY.get(action.type)
            )

            # target_identifier
            assert action.target_identifier == compare_dict.get(
                ACTION_TYPE_2_TARGET_IDENTIFIER_KEY.get(action.type)
            )

            # target_display
            assert action.target_display == compare_dict.get(
                ACTION_TYPE_2_TARGET_DISPLAY_KEY.get(action.type)
            )

    def assert_action(
        self,
        action: Action,
        compare_dict: dict[str, str],
        target_type: ActionTarget = ActionTarget.SPECIFIC,
    ):
        """
        Asserts that the action is equivalent to the compare_dict.
        """
        self.assert_action_attributes(action, compare_dict, target_type)
        self.assert_action_data_blob(action, compare_dict)

    def assert_actions_migrated_correctly(
        self, actions: list[Action], rule_data_actions: list[dict]
    ):
        """
        Asserts that the actions are equivalent to the Rule.
        """
        assert len(actions) == len(rule_data_actions)

        # checks if the action is equivalent to action_data
        for action, rule_data in zip(actions, rule_data_actions):
            assert isinstance(action, Action)
            self.assert_action(action, rule_data)

    def test_slack_action_migration(self):
        # Some examples of action data
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
