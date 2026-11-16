from __future__ import annotations

import uuid
from dataclasses import asdict, replace
from datetime import timedelta
from typing import Any, cast
from unittest import mock
from unittest.mock import patch

import orjson
from django.db import connections, router
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from slack_sdk.web import SlackResponse

from sentry.constants import ObjectStatus
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType, AlertRuleThresholdType
from sentry.incidents.models.incident import IncidentStatus, TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.integrations.slack.message_builder.routing import decode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.integrations.types import IntegrationProviderSlug
from sentry.investigations.models import InvestigationOrchestrationStatus
from sentry.models.activity import Activity
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook, NotebookSourceType, NotebookStatus
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.metric_alert_registry import SlackMetricAlertHandler
from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
    get_detector_serializer,
)
from sentry.notifications.notification_action.utils import (
    _get_metric_alert_investigation_url,
    metric_alert_notification_data_factory,
)
from sentry.notifications.platform.templates.metric_alert import MetricAlertNotificationData
from sentry.seer.models.workflow import SeerWorkflowRunExecution, SeerWorkflowStrategy
from sentry.seer.workflows.breached_metrics import (
    InvestigateBreachedMetricAction,
    MetricBreachInputs,
)
from sentry.seer_workflow_outputs.models import SeerWorkflowOutputLink
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action, Condition
from sentry.workflow_engine.types import ActionInvocation, DetectorPriorityLevel, WorkflowEventData
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)

_HANDLER_PATH = "sentry.notifications.notification_action.metric_alert_registry.handlers.slack_metric_alert_handler"
_UTILS_PATH = "sentry.notifications.notification_action.utils"


class TestSlackMetricAlertHandlerSendAlert(MetricAlertHandlerBase):
    def setUp(self) -> None:
        self.create_models()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.SLACK,
            organization=self.organization,
            user=self.user,
            name="test-slack",
            metadata={"domain_name": "test-workspace.slack.com"},
        )
        self.action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_identifier": "channel123",
                "target_display": "Channel 123",
                "target_type": ActionTarget.SPECIFIC,
            },
        )
        self.handler = SlackMetricAlertHandler()

    def _make_send_alert_kwargs(self) -> dict[str, Any]:
        notification_context = NotificationContext.from_action_model(self.action)
        assert self.group_event.occurrence is not None
        assert self.group_event.occurrence.priority is not None
        priority = DetectorPriorityLevel(self.group_event.occurrence.priority)
        return dict(
            notification_context=notification_context,
            alert_context=AlertContext.from_workflow_engine_models(
                self.detector,
                self.evidence_data,
                self.group_event.group.status,
                priority,
            ),
            metric_issue_context=MetricIssueContext.from_group_event(
                self.group, self.evidence_data, priority
            ),
            open_period_context=OpenPeriodContext.from_group(self.group),
            trigger_status=TriggerStatus.ACTIVE,
            project=self.detector.linked_project,
            organization=self.detector.linked_project.organization,
            notification_uuid=str(uuid.uuid4()),
        )

    def _notification_data(self, **overrides: Any) -> MetricAlertNotificationData:
        kwargs = self._make_send_alert_kwargs()
        kwargs.pop("trigger_status")
        kwargs.pop("project")
        kwargs.update(action_type=self.action.type, chart_url=None)
        kwargs.update(overrides)
        return metric_alert_notification_data_factory(**kwargs)

    def _create_investigation(self, **overrides: Any) -> Notebook:
        kwargs: dict[str, Any] = {
            "organization": self.organization,
            "created_by": self.user,
            "title": "Metric investigation",
            "source_type": NotebookSourceType.METRIC_OPEN_PERIOD,
            "source_key": f"metric_open_period:{self.group.id}:{self.open_period.id}",
            "source_revision": 1,
        }
        kwargs.update(overrides)
        return self.create_notebook(**kwargs)

    @with_feature("organizations:metric-alert-chartcuterie")
    @patch("sentry.integrations.slack.utils.notifications.build_metric_alert_chart")
    @patch("sentry.integrations.slack.utils.notifications.SlackSdkClient")
    def test_send_alert_and_resolution_with_notes_and_chart(
        self,
        mock_slack_client: mock.MagicMock,
        mock_chart: mock.MagicMock,
    ) -> None:
        self.action.update(data={"notes": "Check <https://example.com/runbook|the runbook>"})
        mock_chart.return_value = "https://example.com/chart.png"
        client = mock_slack_client.return_value
        client.chat_postMessage.return_value = {"ok": True, "ts": "123.456"}

        kwargs = self._make_send_alert_kwargs()
        self.handler.send_alert(**kwargs)

        client.chat_postMessage.assert_called_once()
        payload = client.chat_postMessage.call_args.kwargs
        assert payload["channel"] == "channel123"
        blocks = orjson.loads(payload["attachments"])[0]["blocks"]
        assert "123.45" in blocks[0]["text"]["text"]
        expected_notes_and_chart = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "notes: Check <https://example.com/runbook|the runbook>",
                },
            },
            {
                "type": "image",
                "image_url": "https://example.com/chart.png",
                "alt_text": "Metric Alert Chart",
            },
        ]
        assert blocks[1:] == expected_notes_and_chart

        kwargs["metric_issue_context"].new_status = IncidentStatus.CLOSED
        kwargs["trigger_status"] = TriggerStatus.RESOLVED

        self.handler.send_alert(**kwargs)

        assert client.chat_postMessage.call_count == 2
        resolved_payload = client.chat_postMessage.call_args.kwargs
        assert resolved_payload["channel"] == "channel123"
        assert "Resolved" in resolved_payload["text"]
        resolved_blocks = orjson.loads(resolved_payload["attachments"])[0]["blocks"]
        assert resolved_blocks[1:] == expected_notes_and_chart

    @patch("sentry.integrations.slack.utils.notifications.SlackSdkClient")
    def test_send_alert_with_empty_notes(self, mock_slack_client: mock.MagicMock) -> None:
        self.action.update(data={"notes": ""})
        client = mock_slack_client.return_value
        client.chat_postMessage.return_value = {"ok": True, "ts": "123.456"}

        self.handler.send_alert(**self._make_send_alert_kwargs())

        client.chat_postMessage.assert_called_once()
        blocks = orjson.loads(client.chat_postMessage.call_args.kwargs["attachments"])[0]["blocks"]
        assert len(blocks) == 1

    @patch("sentry.integrations.slack.utils.notifications.SlackSdkClient")
    def test_send_alert_skips_disabled_org_integration(
        self, mock_slack_client: mock.MagicMock
    ) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.org_integration.update(status=ObjectStatus.DISABLED)

        self.handler.send_alert(**self._make_send_alert_kwargs())

        mock_slack_client.return_value.chat_postMessage.assert_not_called()

    def _make_send_alert_kwargs_with_workflow(self) -> dict[str, Any]:
        kwargs = self._make_send_alert_kwargs()
        kwargs["notification_context"] = replace(
            kwargs["notification_context"],
            workflow_id=self.workflow.id,
            workflow_name="Page the on-call",
        )
        return kwargs

    @patch("sentry.integrations.slack.utils.notifications.SlackSdkClient")
    def test_send_alert_includes_workflow_link(self, mock_slack_client: mock.MagicMock) -> None:
        client = mock_slack_client.return_value
        client.chat_postMessage.return_value = {"ok": True, "ts": "123.456"}

        self.handler.send_alert(**self._make_send_alert_kwargs_with_workflow())

        client.chat_postMessage.assert_called_once()
        blocks = orjson.loads(client.chat_postMessage.call_args.kwargs["attachments"])[0]["blocks"]
        workflow_url = self.organization.absolute_url(
            f"/organizations/{self.organization.slug}/monitors/alerts/{self.workflow.id}/"
        )
        assert blocks[-1] == {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"Alert: <{workflow_url}|Page the on-call>"},
            ],
        }

    @patch(f"{_HANDLER_PATH}.send_incident_alert_notification")
    @freeze_time("2021-01-01 00:00:00")
    def test_send_alert(self, mock_send_incident: mock.MagicMock) -> None:
        kwargs = self._make_send_alert_kwargs()
        self.handler.send_alert(**kwargs)

        mock_send_incident.assert_called_once_with(
            organization=kwargs["organization"],
            alert_context=kwargs["alert_context"],
            notification_context=kwargs["notification_context"],
            metric_issue_context=kwargs["metric_issue_context"],
            open_period_context=kwargs["open_period_context"],
            detector_serialized_response=get_detector_serializer(self.detector),
            notification_uuid=kwargs["notification_uuid"],
        )

    def _invocation(self, resolved: bool = False) -> ActionInvocation:
        event_data = self.event_data
        if resolved:
            activity = Activity(
                project=self.project,
                group=self.group,
                type=ActivityType.SET_RESOLVED.value,
                data=asdict(self.evidence_data),
            )
            activity.save()
            event_data = WorkflowEventData(
                event=activity, workflow_env=self.workflow.environment, group=self.group
            )
        return ActionInvocation(
            event_data=event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )

    @override_options({"notifications.platform-rollout.internal-testing": {"metric-alert": 1.0}})
    @override_options({"notifications.platform.alert-providers": {"metric-alert": ["slack"]}})
    def _send_platform_alert_and_get_blocks(self, invocation: ActionInvocation) -> list[Any]:
        with (
            with_feature("organizations:notification-platform.internal-testing"),
            patch("sentry.integrations.slack.integration.SlackSdkClient") as mock_client,
        ):
            mock_client.return_value.chat_postMessage.return_value = SlackResponse(
                client=mock_client.return_value,
                http_verb="POST",
                api_url="https://slack.com/api/chat.postMessage",
                req_args={},
                data={"ok": True, "ts": "123.456"},
                headers={},
                status_code=200,
            )
            self.handler.invoke_legacy_registry(invocation)
            payload = mock_client.return_value.chat_postMessage.call_args.kwargs
        return payload["attachments"][0]["blocks"]

    def test_send_alert_via_platform_includes_workflow_link(self) -> None:
        blocks = self._send_platform_alert_and_get_blocks(self._invocation())

        workflow_url = self.organization.absolute_url(
            f"/organizations/{self.organization.slug}/monitors/alerts/{self.workflow.id}/"
        )
        assert blocks[-1] == {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"Alert: <{workflow_url}|{self.workflow.name}>"},
            ],
        }

    @with_feature(["organizations:investigations", "organizations:investigations-slack"])
    def test_send_alert_with_investigation_button(self) -> None:
        blocks = self._send_platform_alert_and_get_blocks(self._invocation())

        assert [block["type"] for block in blocks] == ["section", "actions", "context"]
        (button,) = blocks[1]["elements"]
        assert button["text"]["text"] == "Investigate with Seer"
        routing = decode_action_id(button["action_id"])
        assert routing.action == SlackAction.SEER_INVESTIGATION_START
        assert routing.organization_id == self.organization.id
        assert routing.project_id == self.group.project_id
        assert orjson.loads(button["value"]) == {
            "groupId": self.group.id,
            "openPeriodId": OpenPeriodContext.from_group(self.group).id,
        }

    @with_feature(["organizations:investigations", "organizations:investigations-slack"])
    def test_archived_investigation_has_no_link(self) -> None:
        self._create_investigation(status=NotebookStatus.ARCHIVED)

        data = self._notification_data()

        assert data.investigation_url is None
        assert data.show_investigation_button

    @with_feature(["organizations:investigations", "organizations:investigations-slack"])
    def test_unrelated_investigations_do_not_supply_link(self) -> None:
        self._create_investigation(
            source_key=f"metric_open_period:{self.group.id + 1}:{self.open_period.id}"
        )
        self._create_investigation(
            source_key=f"metric_open_period:{self.group.id}:{self.open_period.id + 1}"
        )
        self._create_investigation(organization=self.create_organization())

        assert self._notification_data().investigation_url is None

    def test_completed_investigation_uses_one_data_query(self) -> None:
        notebook = self._create_investigation()
        self.create_investigation_orchestration_run(
            notebook, status=InvestigationOrchestrationStatus.COMPLETED
        )
        expected_url = notebook.get_absolute_url()
        connection = connections[router.db_for_read(Notebook)]

        with CaptureQueriesContext(connection) as queries:
            url = _get_metric_alert_investigation_url(
                organization=self.organization,
                group_id=self.group.id,
                open_period_id=self.open_period.id,
            )

        assert url == expected_url
        assert len([query for query in queries if query["sql"].startswith("SELECT")]) == 1

    @with_feature(["organizations:investigations", "organizations:investigations-slack"])
    def test_missing_group_does_not_lookup_investigation(self) -> None:
        context = self._make_send_alert_kwargs()["metric_issue_context"]
        context.group = None

        with patch(f"{_UTILS_PATH}._get_metric_alert_investigation_url") as lookup:
            data = self._notification_data(metric_issue_context=context)

        assert not data.show_investigation_button
        assert data.investigation_url is None
        lookup.assert_not_called()

    @with_feature(["organizations:investigations", "organizations:investigations-slack"])
    def test_lookup_database_error_still_sends_alert(self) -> None:
        def fail_lookup(database: str) -> None:
            with connections[database].cursor() as cursor:
                cursor.execute("SELECT * FROM metric_alert_missing_table")

        with (
            patch(f"{_UTILS_PATH}.Notebook.objects.using", side_effect=fail_lookup),
            patch(f"{_UTILS_PATH}.logger") as logger,
        ):
            blocks = self._send_platform_alert_and_get_blocks(self._invocation())

        logger.exception.assert_called_once()
        assert blocks[1]["elements"][0]["text"]["text"] == "Investigate with Seer"
        assert not Notebook.objects.exists()

    def test_url_error_returns_no_investigation_link(self) -> None:
        self._create_investigation()
        with (
            patch.object(Notebook, "get_absolute_url", side_effect=RuntimeError("URL unavailable")),
            patch(f"{_UTILS_PATH}.logger") as logger,
        ):
            url = _get_metric_alert_investigation_url(
                organization=self.organization,
                group_id=self.group.id,
                open_period_id=self.open_period.id,
            )

        logger.exception.assert_called_once()
        assert url is None

    @with_feature(
        [
            "organizations:investigations",
            "organizations:investigations-slack",
            "organizations:service-accounts",
        ]
    )
    def test_send_alert_links_automation_output_for_exact_period(self) -> None:
        earlier_period = OpenPeriodContext.from_group(self.group)
        now = timezone.now()
        self.open_period.update(date_ended=now)
        GroupOpenPeriod.objects.get_or_create(
            group=self.group, project=self.project, date_started=now + timedelta(seconds=1)
        )
        self.group.update(type=MetricIssue.type_id)
        conditions = self.create_data_condition_group(organization=self.organization)
        self.create_data_condition(
            condition_group=conditions,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.detector.update(workflow_condition_group=conditions)
        with outbox_runner():
            account = self.create_service_account(
                organization=self.organization, project_ids=[self.project.id]
            )
        config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            service_account_id=account.id,
        )
        run = Factories.create_seer_workflow_run(self.organization, workflow_config=config)
        execution = Factories.create_seer_workflow_run_execution(run)
        inputs = MetricBreachInputs(
            event_id="a" * 32,
            occurrence_id="b" * 32,
            detector_id=self.detector.id,
            evidence={},
            observed_at=now,
            group_id=self.group.id,
            project_id=self.project.id,
            binding_id=1,
            workflow_id=1,
            action_id=1,
        )

        with patch(
            "sentry.tasks.seer.investigation.dispatch_investigation_orchestration_create.delay"
        ):
            error = InvestigateBreachedMetricAction()._start_investigation(
                config, inputs, execution
            )

        assert error is None
        notebook = SeerWorkflowOutputLink.objects.get(execution=execution).notebook
        assert notebook is not None

        blocks = self._send_platform_alert_and_get_blocks(self._invocation())
        earlier_data = self._notification_data(open_period_context=earlier_period)

        (button,) = blocks[1]["elements"]
        assert button["text"]["text"] == "Open Investigation"
        assert button["url"] == notebook.get_absolute_url()
        assert earlier_data.investigation_url is None
        assert earlier_data.show_investigation_button
        assert Notebook.objects.count() == 1
        assert SeerWorkflowRunExecution.objects.count() == 1

    @with_feature(["organizations:investigations", "organizations:investigations-slack"])
    def test_send_alert_resolved_has_no_investigation_button(self) -> None:
        self._create_investigation()
        blocks = self._send_platform_alert_and_get_blocks(self._invocation(resolved=True))

        assert [block["type"] for block in blocks] == ["section", "context"]

    @with_feature(["organizations:investigations", "organizations:investigations-slack"])
    def test_send_alert_closed_membership_has_no_investigation_button(self) -> None:
        self._create_investigation()
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        blocks = self._send_platform_alert_and_get_blocks(self._invocation())

        assert [block["type"] for block in blocks] == ["section", "context"]

    @with_feature("organizations:investigations")
    def test_send_alert_without_slack_flag_has_no_investigation_button(self) -> None:
        self._create_investigation()
        blocks = self._send_platform_alert_and_get_blocks(self._invocation())

        assert [block["type"] for block in blocks] == ["section", "context"]

    @with_feature("organizations:investigations-slack")
    def test_send_alert_without_investigations_flag_has_no_investigation_button(self) -> None:
        self._create_investigation()
        blocks = self._send_platform_alert_and_get_blocks(self._invocation())

        assert [block["type"] for block in blocks] == ["section", "context"]


_UnpackedSendAlert = tuple[
    NotificationContext, AlertContext, MetricIssueContext, OpenPeriodContext, Organization, str
]


class TestSlackMetricAlertHandlerInvokeRegistry(MetricAlertHandlerBase):
    def unpack_kwargs(self, mock_send_alert: mock.MagicMock) -> _UnpackedSendAlert:
        return cast(_UnpackedSendAlert, super().unpack_kwargs(mock_send_alert))

    """Tests for invoke_legacy_registry — verifies context extraction from GroupEvent and Activity."""

    def setUp(self) -> None:
        self.create_models()
        self.action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=1234567890,
            config={
                "target_identifier": "channel123",
                "target_display": "Channel 123",
                "target_type": ActionTarget.SPECIFIC,
            },
        )
        self.handler = SlackMetricAlertHandler()

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.SlackMetricAlertHandler.send_alert"
    )
    @freeze_time("2021-01-01 00:00:00")
    def test_invoke_legacy_registry(self, mock_send_alert: mock.MagicMock) -> None:
        notification_uuid = str(uuid.uuid4())

        invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=notification_uuid,
            workflow_id=self.workflow.id,
        )

        self.handler.invoke_legacy_registry(invocation)

        assert mock_send_alert.call_count == 1
        (
            notification_context,
            alert_context,
            metric_issue_context,
            open_period_context,
            organization,
            notification_uuid,
        ) = self.unpack_kwargs(mock_send_alert)

        self.assert_notification_context(
            notification_context,
            integration_id=1234567890,
            target_identifier="channel123",
            target_display="Channel 123",
            sentry_app_config=None,
            sentry_app_id=None,
            workflow_id=self.workflow.id,
            workflow_name=self.workflow.name,
        )

        self.assert_alert_context(
            alert_context,
            name=self.detector.name,
            action_identifier_id=self.detector.id,
            threshold_type=AlertRuleThresholdType.ABOVE,
            detection_type=AlertRuleDetectionType.STATIC,
            comparison_delta=None,
            alert_threshold=self.evidence_data.conditions[0]["comparison"],
        )

        self.assert_metric_issue_context(
            metric_issue_context,
            open_period_identifier=self.open_period.id,
            snuba_query=self.snuba_query,
            new_status=IncidentStatus.CRITICAL,
            metric_value=123.45,
            group=self.group_event.group,
            title=self.group_event.group.title,
            subscription=self.subscription,
        )

        self.assert_open_period_context(
            open_period_context,
            id=self.open_period.id,
            date_started=self.group_event.group.first_seen,
            date_closed=None,
        )

        assert organization == self.detector.linked_project.organization
        assert isinstance(notification_uuid, str)

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.SlackMetricAlertHandler.send_alert"
    )
    @freeze_time("2021-01-01 00:00:00")
    def test_invoke_legacy_registry_with_activity(self, mock_send_alert: mock.MagicMock) -> None:
        self.action.update(data={"notes": "Check the runbook"})
        activity = Activity(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data=asdict(self.evidence_data),
        )
        activity.save()

        event_data_with_activity = WorkflowEventData(
            event=activity,
            workflow_env=self.workflow.environment,
            group=self.group,
        )

        invocation = ActionInvocation(
            event_data=event_data_with_activity,
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )

        self.handler.invoke_legacy_registry(invocation)

        assert mock_send_alert.call_count == 1
        (
            notification_context,
            alert_context,
            metric_issue_context,
            open_period_context,
            organization,
            notification_uuid,
        ) = self.unpack_kwargs(mock_send_alert)

        self.assert_notification_context(
            notification_context,
            integration_id=1234567890,
            target_identifier="channel123",
            target_display="Channel 123",
            sentry_app_config=None,
            sentry_app_id=None,
            notes="Check the runbook",
            workflow_id=self.workflow.id,
            workflow_name=self.workflow.name,
        )

        notification_data = metric_alert_notification_data_factory(
            action_type=self.action.type,
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            organization=organization,
            notification_uuid=notification_uuid,
            chart_url=None,
        )
        assert notification_data.notes == "Check the runbook"
        assert notification_data.new_status == IncidentStatus.CLOSED.value

        self.assert_alert_context(
            alert_context,
            name=self.detector.name,
            action_identifier_id=self.detector.id,
            threshold_type=AlertRuleThresholdType.BELOW,
            detection_type=AlertRuleDetectionType.STATIC,
            comparison_delta=None,
            alert_threshold=self.evidence_data.conditions[2]["comparison"],
        )

        self.assert_metric_issue_context(
            metric_issue_context,
            open_period_identifier=self.open_period.id,
            snuba_query=self.snuba_query,
            new_status=IncidentStatus.CLOSED,
            metric_value=123.45,
            group=self.group,
            title=self.group.title,
            subscription=self.subscription,
        )

        self.assert_open_period_context(
            open_period_context,
            id=self.open_period.id,
            date_started=self.group.first_seen,
            date_closed=None,
        )

        assert organization == self.detector.linked_project.organization
        assert isinstance(notification_uuid, str)
