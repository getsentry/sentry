import uuid
from unittest import mock

import responses

from sentry.models.activity import Activity
from sentry.models.options.project_option import ProjectOption
from sentry.notifications.notification_action.action_handler_registry.webhook_handler import (
    WebhookActionHandler,
)
from sentry.plugins.base import plugins
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestWebhookActionHandlerExecute(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow(environment=self.environment)
        self.action = self.create_action(
            type=Action.Type.WEBHOOK,
            config={"target_identifier": "webhooks"},
        )
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(
            event=self.group_event, workflow_env=self.environment, group=self.group
        )
        self.invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://example.com/hook")
        webhook_plugin = plugins.get("webhooks")
        webhook_plugin.set_option("enabled", True, self.project)

    @responses.activate
    def test_default_no_flags_fires_old_path_only(self) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        with self.tasks():
            WebhookActionHandler.execute(self.invocation)

        assert len(responses.calls) == 1

    @responses.activate
    def test_new_path_fires_both_paths(self) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        with self.tasks(), self.feature("organizations:legacy-webhook-new-path"):
            WebhookActionHandler.execute(self.invocation)

        assert len(responses.calls) == 2

    @responses.activate
    def test_new_path_disable_old_fires_new_only(self) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        with (
            self.tasks(),
            self.feature(
                {
                    "organizations:legacy-webhook-new-path": True,
                    "organizations:legacy-webhook-disable-old-path": True,
                }
            ),
        ):
            WebhookActionHandler.execute(self.invocation)

        assert len(responses.calls) == 1
        body = json.loads(responses.calls[0].request.body)
        assert body["id"] == str(self.group.id)

    @responses.activate
    @mock.patch("sentry.sentry_apps.services.legacy_webhook.tasks.logger")
    def test_new_path_dry_run_logs_instead_of_sending(self, mock_logger: mock.MagicMock) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        with (
            self.tasks(),
            self.feature(
                {
                    "organizations:legacy-webhook-new-path": True,
                    "organizations:legacy-webhook-disable-old-path": True,
                    "organizations:legacy-webhook-dry-run": True,
                }
            ),
        ):
            WebhookActionHandler.execute(self.invocation)

        assert len(responses.calls) == 0
        mock_logger.info.assert_called_once()
        assert mock_logger.info.call_args[0][0] == "legacy_webhook.dry_run"

    @responses.activate
    def test_disable_old_without_new_path_fires_nothing(self) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        with self.tasks(), self.feature("organizations:legacy-webhook-disable-old-path"):
            WebhookActionHandler.execute(self.invocation)

        assert len(responses.calls) == 0

    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.webhook_handler.send_legacy_webhooks_for_invocation"
    )
    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.webhook_handler.execute_via_group_type_registry"
    )
    def test_non_group_event_skips_new_path_but_old_path_still_runs(
        self, mock_old_path: mock.MagicMock, mock_new_path: mock.MagicMock
    ) -> None:
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
        )
        invocation = ActionInvocation(
            event_data=WorkflowEventData(
                event=activity, workflow_env=self.environment, group=self.group
            ),
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )

        with self.feature("organizations:legacy-webhook-new-path"):
            WebhookActionHandler.execute(invocation)

        mock_new_path.assert_not_called()
        mock_old_path.assert_called_once_with(invocation)
