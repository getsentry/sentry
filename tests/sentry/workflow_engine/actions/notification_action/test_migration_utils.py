from sentry.models.group import GroupEvent
from sentry.models.rule import Rule
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.actions.notification_action.mappings import (
    ACTION_TYPE_2_INTEGRATION_ID_KEY,
    ACTION_TYPE_2_TARGET_DISPLAY_KEY,
    ACTION_TYPE_2_TARGET_IDENTIFIER_KEY,
    RULE_REGISTRY_ID_2_ACTION_TYPE,
)
from sentry.workflow_engine.actions.notification_action.migration_utils import (
    EXCLUDED_ACTION_DATA_KEYS,
    build_notification_actions_from_rule_data,
)
from sentry.workflow_engine.models.action import Action


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
        keys = [
            ACTION_TYPE_2_INTEGRATION_ID_KEY.get(action.type),
            ACTION_TYPE_2_TARGET_IDENTIFIER_KEY.get(action.type),
            ACTION_TYPE_2_TARGET_DISPLAY_KEY.get(action.type),
            *EXCLUDED_ACTION_DATA_KEYS,
        ]

        # Assert the rest of the data is the same
        for key in compare_dict:
            if key not in keys:
                assert compare_dict[key] == action.data[key]

        # Assert the action data blob doesn't contain more than the keys in the compare_dict
        for key in action.data:
            assert key in compare_dict

    def assert_actions_equivalent_to_rule(self, actions: list[Action], rule: Rule):
        """
        Asserts that the actions are equivalent to the Rule.
        """
        assert len(actions) == len(rule.data.get("actions"))

        # checks if the action is equivalent to action_data
        for action, rule_data in zip(actions, rule.data.get("actions")):
            assert isinstance(action, Action)

            # Check if the action type is correct
            assert action.type == RULE_REGISTRY_ID_2_ACTION_TYPE[rule_data["id"]]

            # Check if the integration_id is correct
            assert action.integration_id == rule_data.get(
                ACTION_TYPE_2_INTEGRATION_ID_KEY.get(action.type)
            )

            # Check if the target_identifier is correct
            if action.type in ACTION_TYPE_2_TARGET_IDENTIFIER_KEY:
                assert action.target_identifier == rule_data.get(
                    ACTION_TYPE_2_TARGET_IDENTIFIER_KEY.get(action.type)
                )

            # Check if the target_display is correct
            if action.type in ACTION_TYPE_2_TARGET_DISPLAY_KEY:
                assert action.target_display == rule_data.get(
                    ACTION_TYPE_2_TARGET_DISPLAY_KEY.get(action.type)
                )

            # Assert the rest of the data is the same
            self.assert_action_data_blob(action, rule_data)

    def test_build_notification_actions_for_slack_and_discord(self):
        action_data = [
            {
                "workspace": "1",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "channel": "alerts-create-issues-is-cool",
                "channel_id": "C06Q38YGW10",
                "tags": "organization_id, organization_slug, project_id, project_slug",
                "uuid": "a22cc730-d9e3-4e16-83f0-8a9a46bdeb33",
                "notes": "raj is cool",
            },
            {
                "server": "1",
                "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                "channel_id": "1271983973425348772",
                "tags": "environment",
                "uuid": "3d85de53-e750-447d-bdab-2d316b9beaa2",
            },
        ]

        self.rule = self.create_project_rule(project=self.project, action_data=action_data)
        actions = build_notification_actions_from_rule_data(self.rule.data.get("actions"))

        self.assert_actions_equivalent_to_rule(actions, self.rule)

    # TODO(iamrajjoshi): Add tests for the other notification action types
