import uuid
from unittest import mock

import responses

from sentry.models.activity import Activity
from sentry.models.options.project_option import ProjectOption
from sentry.notifications.notification_action.action_handler_registry.webhook_handler import (
    WebhookActionHandler,
)
from sentry.plugins.base import plugins
from sentry.testutils.helpers.features import with_feature
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
    def test_new_path_dry_run_does_not_send(self) -> None:
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

    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.webhook_handler.send_sentry_app_webhook"
    )
    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.webhook_handler.send_legacy_webhooks_for_invocation"
    )
    def test_new_path_sentry_app_action_routes_to_sentry_app_webhook(
        self, mock_legacy: mock.MagicMock, mock_sentry_app: mock.MagicMock
    ) -> None:
        action = self.create_action(
            type=Action.Type.WEBHOOK,
            config={"target_identifier": "my-app"},
        )
        invocation = ActionInvocation(
            event_data=self.event_data,
            action=action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )

        with (
            self.feature(
                {
                    "organizations:legacy-webhook-new-path": True,
                    "organizations:legacy-webhook-disable-old-path": True,
                }
            ),
        ):
            WebhookActionHandler.execute(invocation)

        mock_sentry_app.assert_called_once()
        call_kwargs = mock_sentry_app.call_args.kwargs
        assert call_kwargs["group_event"] == self.group_event
        assert call_kwargs["sentry_app_slug"] == "my-app"
        assert "rule_label" in call_kwargs
        mock_legacy.assert_not_called()

    @with_feature(
        {
            "organizations:legacy-webhook-new-path": True,
            "organizations:legacy-webhook-disable-old-path": True,
            "organizations:legacy-webhook-dry-run": True,
        }
    )
    @mock.patch("sentry.sentry_apps.services.legacy_webhook.service.send_alert_webhook_v2")
    def test_new_path_sentry_app_dry_run_does_not_send(
        self, mock_send_alert: mock.MagicMock
    ) -> None:
        action = self.create_action(
            type=Action.Type.WEBHOOK,
            config={"target_identifier": "my-app"},
        )
        invocation = ActionInvocation(
            event_data=self.event_data,
            action=action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )
        self.create_sentry_app(name="My App", organization=self.organization)
        self.create_sentry_app_installation(
            slug="my-app", organization=self.organization, user=self.user
        )

        WebhookActionHandler.execute(invocation)

        mock_send_alert.delay.assert_not_called()

    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.webhook_handler.send_sentry_app_webhook"
    )
    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.webhook_handler.send_legacy_webhooks_for_invocation"
    )
    def test_new_path_webhooks_action_routes_to_legacy_webhook(
        self, mock_legacy: mock.MagicMock, mock_sentry_app: mock.MagicMock
    ) -> None:
        with (
            self.feature(
                {
                    "organizations:legacy-webhook-new-path": True,
                    "organizations:legacy-webhook-disable-old-path": True,
                }
            ),
        ):
            WebhookActionHandler.execute(self.invocation)

        mock_legacy.assert_called_once_with(self.invocation)
        mock_sentry_app.assert_not_called()

    @responses.activate
    @with_feature(
        {
            "organizations:legacy-webhook-new-path": True,
            "organizations:legacy-webhook-disable-old-path": True,
        }
    )
    def test_new_path_disabled_webhooks_does_not_send(self) -> None:
        responses.add(responses.POST, "http://example.com/hook")
        webhook_plugin = plugins.get("webhooks")
        webhook_plugin.set_option("enabled", False, self.project)

        with self.tasks():
            WebhookActionHandler.execute(self.invocation)

        assert len(responses.calls) == 0

    @responses.activate
    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.webhook_handler.execute_via_group_type_registry",
        side_effect=Exception("legacy path error"),
    )
    def test_old_path_exception_does_not_block_new_path(
        self, mock_old_path: mock.MagicMock
    ) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        with self.tasks(), self.feature("organizations:legacy-webhook-new-path"):
            WebhookActionHandler.execute(self.invocation)

        mock_old_path.assert_called_once()
        assert len(responses.calls) == 1
        body = json.loads(responses.calls[0].request.body)
        assert body["id"] == str(self.group.id)
