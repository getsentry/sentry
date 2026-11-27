from typing import Any
from unittest.mock import MagicMock, patch

from sentry.models.activity import Activity
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.workflow_engine.models import Workflow, WorkflowFireHistory
from sentry.workflow_engine.tasks.alert_webhooks import (
    FEATURE_FLAG,
    enqueue_alert_triggered_webhooks,
    send_alert_triggered_webhooks,
)
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.sentry_apps.tasks.test_sentry_apps import MockResponseInstance

TASK_DELAY = "sentry.workflow_engine.tasks.alert_webhooks.send_alert_triggered_webhooks.delay"


class AlertTriggeredWebhookTestBase(TestCase):
    def setUp(self) -> None:
        self.sentry_app = self.create_sentry_app(
            organization=self.organization,
            events=["alert.triggered"],
            webhook_url="https://example.com/webhook",
        )
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )
        self.workflow = self.create_workflow(name="High error rate")
        event = self.store_event(data={"message": "boom"}, project_id=self.project.id)
        assert event.group is not None
        self.group = event.group
        self.group_event = event.for_group(self.group)

    def fire(self, workflow: Workflow) -> WorkflowFireHistory:
        return WorkflowFireHistory.objects.create(
            workflow=workflow, group=self.group, event_id=self.group_event.event_id
        )


class EnqueueAlertTriggeredWebhooksTest(AlertTriggeredWebhookTestBase):
    @patch(TASK_DELAY)
    def test_requires_feature_flag(self, mock_delay: MagicMock) -> None:
        enqueue_alert_triggered_webhooks(
            [self.fire(self.workflow)],
            WorkflowEventData(event=self.group_event, group=self.group),
        )
        mock_delay.assert_not_called()

    @with_feature(FEATURE_FLAG)
    @patch(TASK_DELAY)
    def test_enqueues_fires(self, mock_delay: MagicMock) -> None:
        history = self.fire(self.workflow)

        enqueue_alert_triggered_webhooks(
            [history], WorkflowEventData(event=self.group_event, group=self.group)
        )

        mock_delay.assert_called_once_with(
            organization_id=self.organization.id,
            group_id=self.group.id,
            event_id=self.group_event.event_id,
            fires=[
                {
                    "workflow_id": self.workflow.id,
                    "notification_uuid": str(history.notification_uuid),
                }
            ],
        )

    @with_feature(FEATURE_FLAG)
    @patch(TASK_DELAY)
    def test_activity_fire_has_no_event_id(self, mock_delay: MagicMock) -> None:
        activity = Activity.objects.create(
            project=self.project, group=self.group, type=ActivityType.SET_RESOLVED.value
        )

        enqueue_alert_triggered_webhooks(
            [self.fire(self.workflow)], WorkflowEventData(event=activity, group=self.group)
        )

        assert mock_delay.call_args.kwargs["event_id"] is None

    @with_feature(FEATURE_FLAG)
    @patch(TASK_DELAY)
    def test_skips_fires_without_an_issue(self, mock_delay: MagicMock) -> None:
        enqueue_alert_triggered_webhooks(
            [self.fire(self.workflow)], WorkflowEventData(event=self.group_event, group=None)
        )
        mock_delay.assert_not_called()

    @with_feature(FEATURE_FLAG)
    @patch(TASK_DELAY, side_effect=Exception("broker down"))
    def test_enqueue_failure_does_not_raise(self, mock_delay: MagicMock) -> None:
        enqueue_alert_triggered_webhooks(
            [self.fire(self.workflow)],
            WorkflowEventData(event=self.group_event, group=self.group),
        )
        mock_delay.assert_called_once()


@patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
class SendAlertTriggeredWebhooksTest(AlertTriggeredWebhookTestBase):
    def send(self, *workflows: Workflow) -> None:
        fires: list[dict[str, Any]] = []
        for workflow in workflows:
            history = self.fire(workflow)
            fires.append(
                {"workflow_id": workflow.id, "notification_uuid": str(history.notification_uuid)}
            )
        with self.tasks():
            send_alert_triggered_webhooks(
                organization_id=self.organization.id,
                group_id=self.group.id,
                event_id=self.group_event.event_id,
                fires=fires,
            )

    def test_sends_payload(self, safe_urlopen: MagicMock) -> None:
        self.send(self.workflow)

        assert safe_urlopen.call_count == 1
        kwargs = safe_urlopen.call_args.kwargs
        assert kwargs["url"] == "https://example.com/webhook"
        assert kwargs["headers"]["Sentry-Hook-Resource"] == "alert"
        body = json.loads(kwargs["data"])
        assert body["action"] == "triggered"
        data = body["data"]
        assert data["alert"]["id"] == self.workflow.id
        assert data["alert"]["title"] == "High error rate"
        assert data["alert"]["web_url"].endswith(f"/monitors/alerts/{self.workflow.id}/")
        assert data["issue"]["id"] == str(self.group.id)
        assert data["event_id"] == self.group_event.event_id
        assert data["notification_uuid"]

    def test_skips_non_alert_workflows(self, safe_urlopen: MagicMock) -> None:
        inbox_workflow = self.create_workflow(name="inbox", type=Workflow.Type.INBOX)

        self.send(inbox_workflow)

        safe_urlopen.assert_not_called()

    def test_one_webhook_per_workflow(self, safe_urlopen: MagicMock) -> None:
        other = self.create_workflow(name="Other alert")

        self.send(self.workflow, other)

        sent_ids = {
            json.loads(call.kwargs["data"])["data"]["alert"]["id"]
            for call in safe_urlopen.call_args_list
        }
        assert sent_ids == {self.workflow.id, other.id}

    def test_skips_unsubscribed_apps(self, safe_urlopen: MagicMock) -> None:
        other_app = self.create_sentry_app(
            organization=self.organization,
            events=["issue.created"],
            webhook_url="https://example.com/other",
        )
        self.create_sentry_app_installation(organization=self.organization, slug=other_app.slug)

        self.send(self.workflow)

        assert [call.kwargs["url"] for call in safe_urlopen.call_args_list] == [
            "https://example.com/webhook"
        ]

    def test_missing_group(self, safe_urlopen: MagicMock) -> None:
        with self.tasks():
            send_alert_triggered_webhooks(
                organization_id=self.organization.id,
                group_id=self.group.id + 1000,
                event_id=None,
                fires=[
                    {
                        "workflow_id": self.workflow.id,
                        "notification_uuid": "00000000-0000-0000-0000-000000000000",
                    }
                ],
            )

        safe_urlopen.assert_not_called()
