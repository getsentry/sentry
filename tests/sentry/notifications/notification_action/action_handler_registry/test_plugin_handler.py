import uuid
from unittest import mock

import responses

from sentry.models.activity import Activity
from sentry.models.options.project_option import ProjectOption
from sentry.notifications.notification_action.action_handler_registry.plugin_handler import (
    PluginActionHandler,
)
from sentry.plugins.base import plugins
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestPluginActionHandlerExecute(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow(environment=self.environment)
        self.action = self.create_action(
            type=Action.Type.PLUGIN,
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
            PluginActionHandler.execute(self.invocation)

        assert len(responses.calls) == 1

    @responses.activate
    @with_feature(
        {
            "organizations:legacy-webhook-new-path": True,
            "organizations:legacy-webhook-disable-old-path": True,
        }
    )
    def test_new_path_skips_webhooks_in_old_path(self) -> None:
        """When new path is on and old path disabled, webhooks are sent via the
        new task-based service and skipped in the old path."""
        responses.add(responses.POST, "http://example.com/hook")

        with self.tasks():
            PluginActionHandler.execute(self.invocation)

        assert len(responses.calls) == 1
        body = json.loads(responses.calls[0].request.body)
        assert body["id"] == str(self.group.id)

    @with_feature("organizations:legacy-webhook-new-path")
    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.plugin_handler.send_legacy_webhooks_for_invocation"
    )
    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.plugin_handler.execute_via_group_type_registry"
    )
    def test_old_path_always_runs(
        self, mock_old_path: mock.MagicMock, mock_new_path: mock.MagicMock
    ) -> None:
        """Old path runs regardless of flags to keep non-webhook plugins firing."""
        PluginActionHandler.execute(self.invocation)

        mock_old_path.assert_called_once_with(self.invocation)
        mock_new_path.assert_called_once_with(self.invocation)

    @with_feature("organizations:legacy-webhook-new-path")
    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.plugin_handler.send_legacy_webhooks_for_invocation"
    )
    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.plugin_handler.execute_via_group_type_registry"
    )
    def test_non_group_event_skips_both_paths(
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

        PluginActionHandler.execute(invocation)

        mock_old_path.assert_not_called()
        mock_new_path.assert_not_called()

    @responses.activate
    @with_feature("organizations:legacy-webhook-new-path")
    @mock.patch(
        "sentry.notifications.notification_action.action_handler_registry.plugin_handler.execute_via_group_type_registry",
        side_effect=Exception("legacy path error"),
    )
    def test_old_path_exception_does_not_block_new_path(
        self, mock_old_path: mock.MagicMock
    ) -> None:
        responses.add(responses.POST, "http://example.com/hook")

        with self.tasks():
            PluginActionHandler.execute(self.invocation)

        mock_old_path.assert_called_once()
        assert len(responses.calls) == 1
        body = json.loads(responses.calls[0].request.body)
        assert body["id"] == str(self.group.id)
