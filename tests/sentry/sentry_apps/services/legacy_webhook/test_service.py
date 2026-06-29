import uuid
from unittest import mock
from unittest.mock import MagicMock

from django.urls import reverse

from sentry.models.options.project_option import ProjectOption
from sentry.sentry_apps.services.legacy_webhook.service import (
    build_legacy_webhook_payload,
    send_legacy_webhooks_for_invocation,
    send_sentry_app_webhook,
    split_urls,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
from sentry.utils.http import absolute_uri
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
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", True)
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://a.com\nhttp://b.com")

        send_legacy_webhooks_for_invocation(self.invocation)

        assert mock_task.delay.call_count == 2
        urls_called = {call.kwargs["url"] for call in mock_task.delay.call_args_list}
        assert urls_called == {"http://a.com", "http://b.com"}

    @mock.patch(
        "sentry.sentry_apps.services.legacy_webhook.tasks.send_legacy_webhook_task",
    )
    def test_no_urls_configured_is_noop(self, mock_task: mock.MagicMock) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", True)

        send_legacy_webhooks_for_invocation(self.invocation)

        assert mock_task.delay.call_count == 0

    @mock.patch(
        "sentry.sentry_apps.services.legacy_webhook.tasks.send_legacy_webhook_task",
    )
    def test_webhooks_disabled_is_noop(self, mock_task: mock.MagicMock) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://a.com")

        send_legacy_webhooks_for_invocation(self.invocation)

        assert mock_task.delay.call_count == 0

    @mock.patch(
        "sentry.sentry_apps.services.legacy_webhook.tasks.send_legacy_webhook_task",
    )
    def test_webhooks_explicitly_disabled_is_noop(self, mock_task: mock.MagicMock) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", False)
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://a.com")

        send_legacy_webhooks_for_invocation(self.invocation)

        assert mock_task.delay.call_count == 0

    @mock.patch(
        "sentry.sentry_apps.services.legacy_webhook.tasks.send_legacy_webhook_task",
    )
    def test_triggering_rules_uses_workflow_name(self, mock_task: mock.MagicMock) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", True)
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://a.com")

        send_legacy_webhooks_for_invocation(self.invocation)

        payload = mock_task.delay.call_args.kwargs["payload"]
        assert payload["triggering_rules"] == [self.workflow.name]

    @mock.patch(
        "sentry.sentry_apps.services.legacy_webhook.tasks.send_legacy_webhook_task",
    )
    def test_triggering_rules_prefers_legacy_rule_label(self, mock_task: mock.MagicMock) -> None:
        rule = self.create_project_rule(project=self.project)
        rule.label = "My Custom Rule Name"
        rule.save()
        self.create_alert_rule_workflow(rule_id=rule.id, workflow=self.workflow)

        ProjectOption.objects.set_value(self.project, "webhooks:enabled", True)
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://a.com")

        send_legacy_webhooks_for_invocation(self.invocation)

        payload = mock_task.delay.call_args.kwargs["payload"]
        assert payload["triggering_rules"] == ["My Custom Rule Name"]


class TestSendSentryAppWebhook(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.sentry_app = self.create_sentry_app(
            organization=self.organization,
            name="My Test App",
            is_alertable=True,
        )
        self.group, self.event, self.group_event = self.create_group_event()

    @mock.patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_sends_signed_webhook_to_sentry_app(self, safe_urlopen: MagicMock) -> None:
        safe_urlopen.return_value = mock.MagicMock(
            ok=True,
            status_code=200,
            headers={},
            content=b"{}",
            text="",
            raise_for_status=lambda: None,
        )
        self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

        with self.tasks():
            send_sentry_app_webhook(
                group_event=self.group_event,
                sentry_app_slug=self.sentry_app.slug,
                rule_label="My Rule",
                organization=self.organization,
            )

        assert safe_urlopen.called
        ((_, kwargs),) = safe_urlopen.call_args_list
        data = json.loads(kwargs["data"])

        assert data["action"] == "triggered"
        assert "installation" in data
        assert data["data"]["triggered_rule"] == "My Rule"
        assert data["data"]["event"]["event_id"] == self.group_event.event_id
        assert data["data"]["event"]["project"] == self.project.id
        assert data["data"]["event"]["issue_id"] == str(self.group.id)
        assert data["data"]["event"]["url"] == absolute_uri(
            reverse(
                "sentry-api-0-project-event-details",
                args=[self.organization.slug, self.project.slug, self.group_event.event_id],
            )
        )

        assert kwargs["headers"].keys() >= {
            "Content-Type",
            "Request-ID",
            "Sentry-Hook-Resource",
            "Sentry-Hook-Timestamp",
            "Sentry-Hook-Signature",
        }

    @mock.patch(
        "sentry.sentry_apps.tasks.sentry_apps.send_alert_webhook_v2",
    )
    def test_missing_app_logs_warning(self, mock_task: mock.MagicMock) -> None:
        with mock.patch("sentry.sentry_apps.services.legacy_webhook.service.logger") as mock_logger:
            send_sentry_app_webhook(
                group_event=self.group_event,
                sentry_app_slug="nonexistent-app",
                rule_label="My Rule",
                organization=self.organization,
            )

        mock_logger.warning.assert_called_once_with(
            "webhook_action_handler.sentry_app_not_found",
            extra={
                "organization_id": self.organization.id,
                "sentry_app_slug": "nonexistent-app",
            },
        )
        mock_task.delay.assert_not_called()
