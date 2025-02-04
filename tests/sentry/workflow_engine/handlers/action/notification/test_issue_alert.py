import uuid
from unittest import mock

import pytest

from sentry.constants import ObjectStatus
from sentry.models.rule import Rule, RuleSource
from sentry.workflow_engine.handlers.action.notification.issue_alert import (
    BaseIssueAlertHandler,
    DiscordIssueAlertHandler,
)
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestBaseIssueAlertHandler(BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.action = Action(type=Action.Type.DISCORD)
        self.group, self.event, self.group_event = self.create_group_event()
        self.job = WorkflowJob(event=self.group_event)

        class TestHandler(BaseIssueAlertHandler):
            def build_rule_action_blob(self, action: Action) -> dict:
                return {"test": "data"}

        self.handler = TestHandler()

    def test_create_rule_instance_from_action(self):
        """Test that create_rule_instance_from_action creates a Rule with correct attributes"""
        rule = self.handler.create_rule_instance_from_action(self.action, self.detector)

        assert isinstance(rule, Rule)
        assert rule.id == self.detector.id
        assert rule.project == self.detector.project
        assert rule.label == self.detector.name
        assert rule.data == {"actions": [{"test": "data"}]}
        assert rule.status == ObjectStatus.ACTIVE
        assert rule.source == RuleSource.ISSUE

    @mock.patch("sentry.workflow_engine.handlers.action.notification.issue_alert.safe_execute")
    @mock.patch(
        "sentry.workflow_engine.handlers.action.notification.issue_alert.instantiate_action"
    )
    @mock.patch("uuid.uuid4")
    def test_invoke_legacy_registry(self, mock_uuid, mock_instantiate_action, mock_safe_execute):
        """Test that invoke_legacy_registry correctly processes the action"""
        mock_uuid.return_value = uuid.UUID("12345678-1234-5678-1234-567812345678")
        mock_action = mock.Mock()
        mock_instantiate_action.return_value = mock_action
        mock_future = mock.Mock()
        mock_safe_execute.side_effect = [[mock_future], None]  # Return for after, then for callback

        self.handler.invoke_legacy_registry(self.job, self.action, self.detector)

        # Verify action instantiation
        mock_instantiate_action.assert_called_once()

        # Verify after method called with correct args
        mock_safe_execute.assert_any_call(
            mock_action.after,
            event=self.job["event"],
            notification_uuid="12345678-1234-5678-1234-567812345678",
        )

        # Verify callback execution
        mock_safe_execute.assert_any_call(mock_future.callback, self.job["event"], mock.ANY)

    @mock.patch(
        "sentry.workflow_engine.handlers.action.notification.issue_alert.instantiate_action",
        return_value=None,
    )
    def test_invoke_legacy_registry_no_action(self, mock_instantiate_action):
        """Test that invoke_legacy_registry raises an error if no action is found"""
        with pytest.raises(ValueError):
            self.handler.invoke_legacy_registry(self.job, self.action, self.detector)


class TestDiscordIssueAlertHandler(BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.handler = DiscordIssueAlertHandler()
        self.action = self.create_action(
            type=Action.Type.DISCORD,
            integration_id="1234567890",
            target_identifier="channel456",
            data={"tags": "environment,user,my_tag"},
        )

    def test_build_rule_action_blob(self):
        """Test that build_rule_action_blob creates correct Discord action data"""
        blob = self.handler.build_rule_action_blob(self.action)

        assert blob == {
            "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
            "server": "1234567890",
            "channel_id": "channel456",
            "tags": "environment,user,my_tag",
        }

    def test_build_rule_action_blob_no_tags(self):
        """Test that build_rule_action_blob handles missing tags"""
        self.action.data = {}
        blob = self.handler.build_rule_action_blob(self.action)

        assert blob == {
            "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
            "server": "1234567890",
            "channel_id": "channel456",
            "tags": "",
        }
