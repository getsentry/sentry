from unittest.mock import patch

from sentry.models.group import GroupEvent
from sentry.models.rule import Rule
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.actions.action_handlers_registry import trigger_action
from sentry.workflow_engine.actions.notification_action.logic import form_issue_alert_models
from sentry.workflow_engine.actions.notification_action.mappings import (
    ACTION_TYPE_2_INTEGRATION_ID_KEY,
    ACTION_TYPE_2_TARGET_DISPLAY_KEY,
    ACTION_TYPE_2_TARGET_IDENTIFIER_KEY,
)
from sentry.workflow_engine.actions.notification_action.migration_utils import (
    EXCLUDED_ACTION_DATA_KEYS,
)
from sentry.workflow_engine.models.action import Action


class TestNotificationActionBase(TestCase):
    """
    Base class for testing notification actions.
    """

    def setUp(self):
        self.group = self.create_group(project=self.project)
        self.group_event = GroupEvent.from_event(self.event, self.group)

        # Build the detector
        self.detector = self.create_detector(project=self.project)

        # Build the data source
        self.data_source = self.create_data_source(
            organization=self.project.organization, type="IssueOccurrence"
        )

        # Build the data source detector
        self.data_source_detector = self.create_data_source_detector(
            data_source=self.data_source,
            detector=self.detector,
        )


class TestNotificationActionLogicIssueAlertRegistry(TestNotificationActionBase):
    """
    Tests for notification action logic that invokes the issue alert registry.
    """

    def assert_rule_equivalent_to_action(self, rule: Rule, action: Action):
        assert rule.id == self.detector.id
        assert rule.project == self.detector.project
        assert rule.label == self.detector.name

        assert len(rule.data.get("actions")) == 1

        actions_data_blob = rule.data.get("actions")[0]
        assert isinstance(actions_data_blob, dict)

        # Check if the integration_id is correct
        assert action.integration_id == actions_data_blob.get(
            ACTION_TYPE_2_INTEGRATION_ID_KEY.get(action.type)
        )

        # Check if the target_identifier is correct
        if action.type in ACTION_TYPE_2_TARGET_IDENTIFIER_KEY:
            assert action.target_identifier == actions_data_blob.get(
                ACTION_TYPE_2_TARGET_IDENTIFIER_KEY.get(action.type)
            )

        # Check if the target_display is correct
        if action.type in ACTION_TYPE_2_TARGET_DISPLAY_KEY:
            assert action.target_display == actions_data_blob.get(
                ACTION_TYPE_2_TARGET_DISPLAY_KEY.get(action.type)
            )

        # Assert the rest of the data is the same
        for key in action.data:
            assert key not in EXCLUDED_ACTION_DATA_KEYS
            assert action.data[key] == actions_data_blob.get(key)

    def assert_rule_fire_history(
        self, rule: Rule, rule_fire_history: RuleFireHistory, notification_uuid: str, action: Action
    ):
        assert rule_fire_history.project == self.detector.project
        assert rule_fire_history.rule == rule
        assert rule_fire_history.group.id == self.group_event.group_id
        assert rule_fire_history.event_id == self.group_event.event_id
        assert rule_fire_history.notification_uuid == notification_uuid

    def test_form_issue_alert_models_slack(self):
        action = self.create_action(
            type=Action.Type.NOTIFICATION_SLACK,
            integration_id="1",
            target_identifier="QWERTY",
            target_display="#test-channel",
        )

        rule, rule_fire_history, notification_uuid = form_issue_alert_models(
            action, self.detector, self.group_event
        )

        self.assert_rule_equivalent_to_action(rule, action)
        self.assert_rule_fire_history(rule, rule_fire_history, notification_uuid, action)

    def test_form_issue_alert_models_discord(self):
        action = self.create_action(
            type=Action.Type.NOTIFICATION_DISCORD,
            integration_id="1",
            target_identifier="1234567890",
        )

        rule, rule_fire_history, notification_uuid = form_issue_alert_models(
            action, self.detector, self.group_event
        )

        self.assert_rule_equivalent_to_action(rule, action)
        self.assert_rule_fire_history(rule, rule_fire_history, notification_uuid, action)

    # TODO(iamrajjoshi): Add tests for the other integrations

    # TODO(iamrajjoshi): Write a test for invoke_issue_alert_registry without mocking


class TestNotificationAction(TestNotificationActionBase):
    """
    Tests for notification actions.
    """

    @patch("sentry.workflow_engine.actions.notification_action.logic.invoke_issue_alert_registry")
    def test_issue_alert_registry_invoked(self, mock_invoke_issue_alert_registry):
        # self.data_source is of type IssueOccurrence
        action = self.create_action(
            type=Action.Type.NOTIFICATION_SLACK,
            integration_id="1",
            target_identifier="QWERTY",
            target_display="#test-channel",
        )

        trigger_action(action, self.group_event)

        mock_invoke_issue_alert_registry.assert_called_once_with(
            self.action, self.detector, self.group_event
        )
