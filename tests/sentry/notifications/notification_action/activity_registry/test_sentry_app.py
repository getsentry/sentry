from unittest import mock

import pytest

from sentry.notifications.notification_action.activity_registry.sentry_app import (
    SentryAppActivityHandler,
    _build_activity_data,
    _build_workflow_data,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import ActionTarget
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestSentryAppActivityHandlerRegistration:
    def test_sentry_app_registered(self) -> None:
        assert activity_handler_registry.get(Action.Type.SENTRY_APP) is SentryAppActivityHandler

    def test_webhook_registered(self) -> None:
        assert activity_handler_registry.get(Action.Type.WEBHOOK) is SentryAppActivityHandler


class TestBuildActivityData(BaseWorkflowTest):
    def test_rca_completed_includes_summary(self) -> None:
        activity = self.create_group_activity(
            group=self.create_group(),
            type=ActivityType.SEER_RCA_COMPLETED.value,
            data={"run_id": "abc", "summary": "Found the root cause"},
        )
        result = _build_activity_data(activity)
        assert result["type"] == "seer_root_cause_completed"
        assert result["details"] == {"summary": "Found the root cause"}

    def test_solution_completed_includes_summary(self) -> None:
        activity = self.create_group_activity(
            group=self.create_group(),
            type=ActivityType.SEER_SOLUTION_COMPLETED.value,
            data={"summary": "Apply the fix"},
        )
        result = _build_activity_data(activity)
        assert result["type"] == "seer_solution_completed"
        assert result["details"] == {"summary": "Apply the fix"}

    def test_pr_created_extracts_pull_requests(self) -> None:
        activity = self.create_group_activity(
            group=self.create_group(),
            type=ActivityType.SEER_PR_CREATED.value,
            data={
                "pull_requests": [
                    {
                        "repo_name": "org/repo",
                        "pull_request": {"pr_url": "https://github.com/org/repo/pull/1"},
                    }
                ]
            },
        )
        result = _build_activity_data(activity)
        assert result["type"] == "seer_pr_created"
        assert result["details"]["pull_requests"] == [
            {"repo_name": "org/repo", "url": "https://github.com/org/repo/pull/1"}
        ]

    def test_iteration_completed_extracts_details(self) -> None:
        activity = self.create_group_activity(
            group=self.create_group(),
            type=ActivityType.SEER_ITERATION_COMPLETED.value,
            data={
                "pull_requests": [
                    {
                        "repo_name": "owner/repo",
                        "pull_request": {
                            "pr_number": 42,
                            "pr_url": "https://github.com/owner/repo/pull/42",
                        },
                    }
                ],
                "code_changes": {"owner/repo": [{"diff": "...", "path": "foo.py"}]},
                "iteration_index": 2,
            },
        )
        result = _build_activity_data(activity)
        assert result["type"] == "seer_pr_iteration_completed"
        assert result["details"]["pull_requests"] == [
            {"repo_name": "owner/repo", "url": "https://github.com/owner/repo/pull/42"}
        ]
        assert result["details"]["code_changes"] == {
            "owner/repo": [{"diff": "...", "path": "foo.py"}]
        }
        assert result["details"]["iteration_index"] == 2

    def test_started_types_have_empty_details(self) -> None:
        for activity_type in [
            ActivityType.SEER_RCA_STARTED,
            ActivityType.SEER_SOLUTION_STARTED,
            ActivityType.SEER_CODING_STARTED,
            ActivityType.SEER_CODING_COMPLETED,
            ActivityType.SEER_ITERATION_STARTED,
        ]:
            activity = self.create_group_activity(
                group=self.create_group(),
                type=activity_type.value,
            )
            result = _build_activity_data(activity)
            assert result["details"] == {}, f"Expected empty details for {activity_type}"

    @mock.patch("sentry.models.activity.activity_to_action")
    def test_unrecognized_activity_type_raises(self, mock_act2act: mock.MagicMock) -> None:
        mock_act2act.return_value = None
        activity = self.create_group_activity(
            group=self.create_group(),
            type=999,
        )
        with pytest.raises(ValueError, match="Unrecognized activity type"):
            _build_activity_data(activity)

    def test_status_change_activity_includes_user(self) -> None:
        activity = self.create_group_activity(
            group=self.create_group(),
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
        )
        result = _build_activity_data(activity)
        assert result["type"] == "status_resolved"
        assert "user" in result["details"]
        assert result["details"]["user"]["id"] == self.user.id
        assert result["details"]["user"]["name"] == self.user.get_display_name()
        assert result["details"]["user"]["username"] == self.user.username


class TestBuildWorkflowData(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.workflow, self.detector, _, _ = self.create_detector_and_workflow()
        self.sentry_app = self.create_sentry_app(
            organization=self.organization,
            webhook_url="https://example.com/webhook",
        )
        self.install = self.create_sentry_app_installation(
            slug=self.sentry_app.slug,
            organization=self.organization,
        )

    def test_builds_workflow_data(self) -> None:
        action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(self.sentry_app.id),
                "target_type": ActionTarget.SENTRY_APP.value,
            },
        )
        activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_RCA_STARTED.value
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )
        from sentry.sentry_apps.services.app import app_service

        rpc_install = app_service.get_many(
            filter=dict(
                app_ids=[self.sentry_app.id],
                organization_id=self.organization.id,
            )
        )[0]

        result = _build_workflow_data(invocation, self.organization, rpc_install)
        assert result["id"] == self.workflow.id
        assert result["title"] == self.workflow.name
        assert result["sentry_app_id"] == self.sentry_app.id

        assert result["url"].endswith(
            f"/api/0/organizations/{self.organization.slug}/workflows/{self.workflow.id}/"
        )
        assert f"alerts/{self.workflow.id}/" in result["web_url"]
        assert "settings" not in result

    def test_includes_settings_when_present(self) -> None:
        settings = [{"name": "channel", "value": "#alerts"}]
        action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(self.sentry_app.id),
                "target_type": ActionTarget.SENTRY_APP.value,
            },
            data={"settings": settings},
        )
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )
        from sentry.sentry_apps.services.app import app_service

        rpc_install = app_service.get_many(
            filter=dict(
                app_ids=[self.sentry_app.id],
                organization_id=self.organization.id,
            )
        )[0]

        result = _build_workflow_data(invocation, self.organization, rpc_install)
        assert result["settings"] == settings


class TestSentryAppActivityHandlerInvokeAction(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.workflow, self.detector, _, _ = self.create_detector_and_workflow()
        self.sentry_app = self.create_sentry_app(
            organization=self.organization,
            webhook_url="https://example.com/webhook",
        )
        self.sentry_app_installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug,
            organization=self.organization,
        )
        self.action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(self.sentry_app.id),
                "target_type": ActionTarget.SENTRY_APP.value,
            },
        )

    @mock.patch("sentry.sentry_apps.tasks.sentry_apps.send_activity_alert_webhook")
    def test_sends_webhook_with_correct_payload_structure(self, mock_task: mock.MagicMock) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_COMPLETED.value,
            data={"run_id": "abc123", "summary": "Found the root cause"},
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )

        SentryAppActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_task.delay.assert_called_once()
        call_kwargs = mock_task.delay.call_args[1]
        assert call_kwargs["sentry_app_id"] == self.sentry_app.id
        assert call_kwargs["organization_id"] == self.organization.id

        payload = json.loads(call_kwargs["payload_json"])
        assert "issue" in payload
        assert "activity" in payload
        assert "alert" in payload

    @mock.patch("sentry.sentry_apps.tasks.sentry_apps.send_activity_alert_webhook")
    def test_webhook_type_resolves_by_slug(self, mock_task: mock.MagicMock) -> None:
        self.action.update(
            type=Action.Type.WEBHOOK,
            config={"target_identifier": self.sentry_app.slug, "target_type": None},
        )
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )

        SentryAppActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_task.delay.assert_called_once()
        assert mock_task.delay.call_args[1]["sentry_app_id"] == self.sentry_app.id

    @mock.patch("sentry.sentry_apps.tasks.sentry_apps.send_activity_alert_webhook")
    def test_missing_installation_raises(self, mock_task: mock.MagicMock) -> None:
        self.action.update(
            config={"target_identifier": "99999", "target_type": ActionTarget.SENTRY_APP.value}
        )
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )

        with pytest.raises(ValueError, match="Expected 1 sentry app installation"):
            SentryAppActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_task.delay.assert_not_called()
