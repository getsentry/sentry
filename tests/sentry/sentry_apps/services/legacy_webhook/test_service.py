import uuid
from unittest import mock

from sentry.models.options.project_option import ProjectOption
from sentry.sentry_apps.services.legacy_webhook.service import (
    build_legacy_webhook_payload,
    send_legacy_webhooks_for_invocation,
    split_urls,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]


class TestSplitUrls(TestCase):
    def test_splits_newline_separated(self) -> None:
        assert split_urls("http://a.com\nhttp://b.com") == ["http://a.com", "http://b.com"]

    def test_empty_string(self) -> None:
        assert split_urls("") == []

    def test_strips_whitespace(self) -> None:
        assert split_urls("  http://a.com  \n  http://b.com  ") == [
            "http://a.com",
            "http://b.com",
        ]

    def test_filters_blank_lines(self) -> None:
        assert split_urls("http://a.com\n\nhttp://b.com\n") == ["http://a.com", "http://b.com"]


class TestBuildLegacyWebhookPayload(BaseWorkflowTest):
    def test_build_payload_matches_legacy_plugin(self) -> None:
        detector = self.create_detector(project=self.project)
        workflow = self.create_workflow(environment=self.environment)
        action = self.create_action(
            type=Action.Type.WEBHOOK,
            config={"target_identifier": "webhooks"},
        )
        group, event, group_event = self.create_group_event()
        event_data = WorkflowEventData(
            event=group_event, workflow_env=self.environment, group=group
        )
        invocation = ActionInvocation(
            event_data=event_data,
            action=action,
            detector=detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=workflow.id,
        )

        payload = build_legacy_webhook_payload(invocation)

        assert payload["id"] == str(group.id)
        assert payload["project"] == self.project.slug
        assert payload["project_name"] == self.project.name
        assert payload["project_slug"] == self.project.slug
        assert payload["message"] == group_event.message
        assert payload["triggering_rules"] == [workflow.name]
        assert payload["event"]["event_id"] == group_event.event_id
        assert payload["event"]["id"] == group_event.event_id
        assert "tags" in payload["event"]


class TestSendLegacyWebhooksForInvocation(BaseWorkflowTest):
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

    @mock.patch(
        "sentry.sentry_apps.services.legacy_webhook.tasks.send_legacy_webhook_task",
    )
    def test_dispatches_task_per_url(self, mock_task: mock.MagicMock) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://a.com\nhttp://b.com")

        send_legacy_webhooks_for_invocation(self.invocation)

        assert mock_task.delay.call_count == 2
        urls_called = {call.kwargs["url"] for call in mock_task.delay.call_args_list}
        assert urls_called == {"http://a.com", "http://b.com"}

    @mock.patch(
        "sentry.sentry_apps.services.legacy_webhook.tasks.send_legacy_webhook_task",
    )
    def test_no_urls_configured_is_noop(self, mock_task: mock.MagicMock) -> None:
        send_legacy_webhooks_for_invocation(self.invocation)

        assert mock_task.delay.call_count == 0

    @mock.patch(
        "sentry.sentry_apps.services.legacy_webhook.tasks.send_legacy_webhook_task",
    )
    def test_triggering_rules_uses_workflow_name(self, mock_task: mock.MagicMock) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://a.com")

        send_legacy_webhooks_for_invocation(self.invocation)

        payload = mock_task.delay.call_args.kwargs["payload"]
        assert payload["triggering_rules"] == [self.workflow.name]
