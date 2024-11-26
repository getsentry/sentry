from sentry.models.group import GroupEvent
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.nowa.logic import (
    EXCLUDED_ACTION_DATA_KEYS,
    build_nowa_instances_from_actions,
)
from sentry.workflow_engine.nowa.mappings import (
    ACTION_TYPE_2_INTEGRATION_ID_KEY,
    ACTION_TYPE_2_TARGET_DISPLAY_KEY,
    ACTION_TYPE_2_TARGET_IDENTIFIER_KEY,
    RULE_REGISTRY_ID_2_ACTION_TYPE,
)


class TestNowaLogic(TestCase):
    def setUp(self):
        self.detector = Detector.objects.create(
            project=self.project,
            name="Test Detector",
        )

        self.action_data = [
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
                "server": "251046",
                "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                "channel_id": "1271983973425348772",
                "tags": "environment",
                "uuid": "3d85de53-e750-447d-bdab-2d316b9beaa2",
            },
        ]

        self.rule = self.create_project_rule(project=self.project, action_data=self.action_data)
        self.group = self.create_group(project=self.project)
        self.group_event = GroupEvent.from_event(self.event, self.group)

    def assert_action_data(self, action_data: dict, action: Action):
        # assert action blob

        # get keys we need to ignore
        keys = [
            ACTION_TYPE_2_INTEGRATION_ID_KEY[action.type],
            ACTION_TYPE_2_TARGET_IDENTIFIER_KEY[action.type],
            ACTION_TYPE_2_TARGET_DISPLAY_KEY[action.type],
            *EXCLUDED_ACTION_DATA_KEYS,
        ]

        # assert the rest of the data is the same
        for key in action_data:
            if key not in keys:
                assert action_data[key] == action.data[key]

    def assert_action(self, action: Action, action_data: dict):
        # checks if the action is equivalent to action_data
        assert action.type == RULE_REGISTRY_ID_2_ACTION_TYPE[action_data["id"]]

        # integration_id
        assert action.integration_id == action_data.get(
            ACTION_TYPE_2_INTEGRATION_ID_KEY[action.type]
        )

        # target_identifier
        if action.type in ACTION_TYPE_2_TARGET_IDENTIFIER_KEY:
            assert action.target_identifier == action_data.get(
                ACTION_TYPE_2_TARGET_IDENTIFIER_KEY[action.type]
            )

        # target_display
        if action.type in ACTION_TYPE_2_TARGET_DISPLAY_KEY:
            assert action.target_display == action_data.get(
                ACTION_TYPE_2_TARGET_DISPLAY_KEY[action.type]
            )

        # make sure the rest of the data is the same
        self.assert_action_data(action_data, action)

    def test_migrate_rule_to_nowa(self):
        actions = build_nowa_instances_from_actions(self.rule.data.get("actions"))

        assert len(actions) == 2
        assert actions[0].type == Action.Type.NOTIFICATION_SLACK
        self.assert_action(actions[0], self.action_data[0])

        assert actions[1].type == Action.Type.NOTIFICATION_DISCORD
        self.assert_action(actions[1], self.action_data[1])
