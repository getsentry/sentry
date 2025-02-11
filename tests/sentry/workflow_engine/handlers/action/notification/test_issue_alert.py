import uuid
from unittest import mock

from sentry.constants import ObjectStatus
from sentry.models.rule import Rule, RuleSource
from sentry.workflow_engine.handlers.action.notification.issue_alert import (
    BaseIssueAlertHandler,
    DiscordIssueAlertHandler,
)
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowJob
from sentry.workflow_engine.typings.notification_action import ActionFieldMapping
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestBaseIssueAlertHandler(BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow(environment=self.environment)
        self.action = self.create_action(
            type=Action.Type.DISCORD,
            integration_id="1234567890",
            target_identifier="channel456",
            data={"tags": "environment,user,my_tag"},
        )
        self.group, self.event, self.group_event = self.create_group_event()
        self.job = WorkflowJob(event=self.group_event, workflow=self.workflow)

        class TestHandler(BaseIssueAlertHandler):
            @classmethod
            def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping):
                return {"tags": "environment,user,my_tag"}

            @classmethod
            def get_target_display(cls, action: Action, mapping: ActionFieldMapping):
                return {}

        self.handler = TestHandler()

    def test_create_rule_instance_from_action(self):
        """Test that create_rule_instance_from_action creates a Rule with correct attributes"""
        rule = self.handler.create_rule_instance_from_action(self.action, self.detector, self.job)

        assert isinstance(rule, Rule)
        assert rule.id == self.action.id
        assert rule.project == self.detector.project
        assert rule.environment_id is not None
        assert self.workflow.environment is not None
        assert rule.environment_id == self.workflow.environment.id
        assert rule.label == self.detector.name
        assert rule.data == {
            "actions": [
                {
                    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                    "server": "1234567890",
                    "channel_id": "channel456",
                    "tags": "environment,user,my_tag",
                }
            ]
        }
        assert rule.status == ObjectStatus.ACTIVE
        assert rule.source == RuleSource.ISSUE

    def test_create_rule_instance_from_action_no_environment(self):
        """Test that create_rule_instance_from_action creates a Rule with correct attributes"""
        workflow = self.create_workflow()
        job = WorkflowJob(event=self.group_event, workflow=workflow)
        rule = self.handler.create_rule_instance_from_action(self.action, self.detector, job)

        assert isinstance(rule, Rule)
        assert rule.id == self.action.id
        assert rule.project == self.detector.project
        assert rule.environment_id is None
        assert rule.label == self.detector.name
        assert rule.data == {
            "actions": [
                {
                    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                    "server": "1234567890",
                    "channel_id": "channel456",
                    "tags": "environment,user,my_tag",
                }
            ]
        }
        assert rule.status == ObjectStatus.ACTIVE
        assert rule.source == RuleSource.ISSUE

    @mock.patch("sentry.workflow_engine.handlers.action.notification.issue_alert.safe_execute")
    @mock.patch(
        "sentry.workflow_engine.handlers.action.notification.issue_alert.activate_downstream_actions"
    )
    @mock.patch("uuid.uuid4")
    def test_invoke_legacy_registry(
        self, mock_uuid, mock_activate_downstream_actions, mock_safe_execute
    ):
        # Test that invoke_legacy_registry correctly processes the action
        mock_uuid.return_value = uuid.UUID("12345678-1234-5678-1234-567812345678")

        # Mock callback and futures
        mock_callback = mock.Mock()
        mock_futures = [mock.Mock()]
        mock_activate_downstream_actions.return_value = {"some_key": (mock_callback, mock_futures)}

        self.handler.invoke_legacy_registry(self.job, self.action, self.detector)

        # Verify activate_downstream_actions called with correct args
        mock_activate_downstream_actions.assert_called_once_with(
            mock.ANY, self.job["event"], "12345678-1234-5678-1234-567812345678"  # Rule instance
        )

        # Verify callback execution
        mock_safe_execute.assert_called_once_with(mock_callback, self.job["event"], mock_futures)


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
        # self.project = self.create_project()
        # self.detector = self.create_detector(project=self.project)
        # self.group, self.event, self.group_event = self.create_group_event()
        # self.job = WorkflowJob(event=self.group_event)

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
