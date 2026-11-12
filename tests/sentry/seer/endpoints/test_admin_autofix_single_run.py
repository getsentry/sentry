from typing import Any
from unittest.mock import MagicMock, patch

from django.utils import timezone
from rest_framework.response import Response

from sentry.eventstream.base import GroupState
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.investigations.services.breached_metrics import resolve_breached_metric_sources
from sentry.models.group import Group
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.notifications.utils.issue_notification_context import IssueNotificationContext
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.exceptions import NoSeerQuotaException, SeerOutOfCreditsException
from sentry.seer.autofix.steps import AutofixStep
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models.workflow import SeerWorkflowRun, SeerWorkflowStrategy
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.viewer_context import ActorType, get_viewer_context
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient
from sentry.workflow_engine.models import DetectorState
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.workflow import process_workflows
from sentry.workflow_engine.types import DetectorPriorityLevel, WorkflowEventData
from tests.sentry.incidents.utils.test_metric_issue_base import BaseMetricIssueTest


@patch("sentry.seer.endpoints.admin_autofix_single_run.trigger_autofix_agent")
class SeerAdminAutofixSingleRunTest(APITestCase):
    endpoint = "sentry-admin-seer-autofix-single-run"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(is_staff=True)
        self.login_as(user=self.user)
        self.organization = self.create_organization(slug="sentry")
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    def get_response(self, *args: Any, **params: Any) -> Response:
        with patch("sentry.api.permissions.is_active_staff", return_value=True):
            return super().get_response(*args, **params)

    def test_starts_single_run_and_returns_link(self, mock_trigger: MagicMock) -> None:
        mock_trigger.return_value = self.create_seer_run(
            organization=self.organization, seer_run_state_id=321
        )

        response = self.get_success_response(
            organization_slug="sentry", short_id=self.group.qualified_short_id
        )

        kwargs = mock_trigger.call_args.kwargs
        assert kwargs["group"] == self.group
        assert kwargs["step"] == AutofixStep.ROOT_CAUSE
        assert kwargs["referrer"] == AutofixReferrer.ADMIN
        assert kwargs["single_run"] is True
        assert kwargs["user"].id == self.user.id
        assert kwargs.get("stopping_point") is None
        assert response.data["url"] == self.organization.absolute_url(
            f"/organizations/sentry/issues/{self.group.id}/",
            query=f"project={self.project.id}&explorerRunId=321",
        )

    def test_automated_start_uses_automation_stopping_point(self, mock_trigger: MagicMock) -> None:
        self.project.update_option("sentry:seer_automated_run_stopping_point", "root_cause")
        mock_trigger.return_value = self.create_seer_run(
            organization=self.organization, seer_run_state_id=321
        )

        self.get_success_response(
            organization_slug="sentry", short_id=self.group.qualified_short_id, automated=True
        )

        assert mock_trigger.call_args.kwargs["stopping_point"] == AutofixStoppingPoint.ROOT_CAUSE

    def test_automated_start_has_no_owner(self, mock_trigger: MagicMock) -> None:
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=321)
        actor_types = []

        def trigger(**kwargs: Any) -> Any:
            ctx = get_viewer_context()
            actor_types.append(ctx.actor.type if ctx else None)
            return run

        mock_trigger.side_effect = trigger

        self.get_success_response(
            organization_slug="sentry", short_id=self.group.qualified_short_id, automated=True
        )

        kwargs = mock_trigger.call_args.kwargs
        assert kwargs["referrer"] == AutofixReferrer.ADMIN_AUTOMATED
        assert kwargs["user"] is None
        assert kwargs["actor_user_id"] is None
        assert actor_types == [ActorType.SYSTEM]

    def test_coding_agent_project_is_rejected(self, mock_trigger: MagicMock) -> None:
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 456)

        self.get_error_response(
            organization_slug="sentry", short_id=self.group.qualified_short_id, status_code=400
        )

        mock_trigger.assert_not_called()

    def test_out_of_quota_returns_reason(self, mock_trigger: MagicMock) -> None:
        mock_trigger.side_effect = NoSeerQuotaException()

        response = self.get_error_response(
            organization_slug="sentry", short_id=self.group.qualified_short_id, status_code=400
        )

        assert response.data["detail"]

    def test_out_of_credits_returns_reason(self, mock_trigger: MagicMock) -> None:
        mock_trigger.side_effect = SeerOutOfCreditsException()

        response = self.get_error_response(
            organization_slug="sentry", short_id=self.group.qualified_short_id, status_code=400
        )

        assert response.data["detail"]

    def test_unknown_issue_returns_404(self, mock_trigger: MagicMock) -> None:
        self.get_error_response(organization_slug="sentry", short_id="NOPE-1", status_code=404)

        mock_trigger.assert_not_called()

    def test_requires_staff(self, mock_trigger: MagicMock) -> None:
        self.login_as(user=self.create_user())

        with patch("sentry.api.permissions.is_active_staff", return_value=False):
            response = self.client.post(
                "/api/0/internal/seer/autofix/single-run/",
                {"organization_slug": "sentry", "short_id": self.group.qualified_short_id},
            )

        assert response.status_code == 403
        mock_trigger.assert_not_called()


@with_feature("organizations:seer-automations")
class SeerAdminMetricBreachesTest(BaseMetricIssueTest, APITestCase):
    endpoint = "sentry-admin-seer-metric-breaches"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(is_staff=True)
        self.login_as(self.user)
        self.detector.update(config={"detection_type": AlertRuleDetectionType.STATIC.value})
        self.config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            enabled=True,
            monitors=[self.detector],
        )

    def get_response(self, *args: Any, **params: Any) -> Response:
        with patch("sentry.api.permissions.is_active_staff", return_value=True):
            return super().get_response(*args, **params)

    @patch("sentry.issues.ingest.send_issue_occurrence_to_eventstream")
    def test_staff_without_membership_can_create_fresh_issues(self, publish: MagicMock) -> None:
        state = self.create_detector_state(
            detector=self.detector,
            is_triggered=True,
            state=DetectorPriorityLevel.HIGH,
            activation_id=123,
        )
        previous = DetectorState.objects.filter(id=state.id).values().get()
        first = self.get_success_response(
            organizationId=self.organization.id, monitorId=self.detector.id, status_code=201
        )
        second = self.get_success_response(
            organizationId=self.organization.id, monitorId=self.detector.id, status_code=201
        )
        assert first.data["issueId"] != second.data["issueId"]
        assert first.data["eventId"] != second.data["eventId"]
        group = Group.objects.get(id=first.data["issueId"])
        assert first.data["issueUrl"] == group.get_absolute_url()
        assert "[Test breach]" in group.title
        period = get_latest_open_period(group)
        assert period is not None
        assert 899 <= (timezone.now() - period.date_started).total_seconds() <= 905
        source = resolve_breached_metric_sources(
            organization=self.organization,
            source_refs=[(group.id, period.id)],
            accessible_project_ids={self.project.id},
        )[(group.id, period.id)]
        assert source.source["snapshot"]["monitor"]["id"] == str(self.detector.id)
        occurrence = publish.call_args.args[1]
        assert occurrence.evidence_data["conditions"]
        assert publish.call_args.args[2].is_new is True
        event, occurrence, info = publish.call_args.args
        group_event = event.for_group(info.group)
        group_event.occurrence = occurrence
        notification = IssueNotificationContext(
            self.create_action_invocation(
                event=group_event,
                group=info.group,
                action=self.create_action(),
                detector=self.detector,
            )
        )
        assert notification.alert_context.alert_threshold == 5
        assert DetectorState.objects.filter(id=state.id).values().get() == previous
        self.critical_detector_trigger.refresh_from_db()
        assert self.critical_detector_trigger.comparison == 5

    def test_requires_staff(self) -> None:
        with patch("sentry.api.permissions.is_active_staff", return_value=False):
            response = self.client.post(
                "/api/0/internal/seer/metric-breaches/",
                {"organizationId": self.organization.id, "monitorId": self.detector.id},
            )
        assert response.status_code == 403
        assert not Group.objects.filter(type=8001).exists()

    def test_monitor_scoped_to_organization(self) -> None:
        other = self.create_organization(owner=self.user)
        self.get_error_response(
            organizationId=other.id, monitorId=self.detector.id, status_code=404
        )
        assert not Group.objects.filter(type=8001).exists()

    def test_disabled_automation(self) -> None:
        self.config.update(enabled=False)
        response = self.get_error_response(
            organizationId=self.organization.id, monitorId=self.detector.id, status_code=409
        )
        assert response.data == {
            "detail": "The monitor has no enabled, environment-compatible automation."
        }
        assert not Group.objects.filter(type=8001).exists()

    @patch("sentry.seer.endpoints.admin_metric_breaches.create_synthetic_breach")
    def test_unexpected_error_returns_generic_detail(self, create_breach: MagicMock) -> None:
        create_breach.side_effect = RuntimeError("Internal processing failure")

        response = self.get_error_response(
            organizationId=self.organization.id, monitorId=self.detector.id, status_code=503
        )

        assert response.data == {"detail": "Test issue creation is unavailable."}

    @patch("sentry.issues.ingest.send_issue_occurrence_to_eventstream")
    def test_anomaly_monitor_bypasses_evaluation(self, publish: MagicMock) -> None:
        self.detector.update(config={"detection_type": AlertRuleDetectionType.DYNAMIC.value})
        self.critical_detector_trigger.update(
            type=Condition.ANOMALY_DETECTION,
            comparison={"sensitivity": "high", "seasonality": "auto", "threshold_type": 0},
        )
        with patch(
            "sentry.incidents.grouptype.MetricIssueDetectorHandler.evaluate",
            side_effect=AssertionError("Synthetic breaches must not evaluate the monitor"),
        ):
            self.get_success_response(
                organizationId=self.organization.id, monitorId=self.detector.id, status_code=201
            )
        publish.assert_called_once()

    @patch("sentry.issues.ingest.send_issue_occurrence_to_eventstream")
    def test_dispatches_through_connected_workflows(self, publish: MagicMock) -> None:
        with outbox_runner():
            account = self.create_service_account(
                organization=self.organization, project_ids=[self.project.id]
            )
        self.config.update(service_account_id=account.id)
        notebook = self.create_notebook(self.organization, title="Test metric investigation")
        response = self.get_success_response(
            organizationId=self.organization.id, monitorId=self.detector.id, status_code=201
        )
        event, occurrence, info = publish.call_args.args
        group_event = event.for_group(info.group)
        group_event.occurrence = occurrence
        with (
            self.tasks(),
            patch(
                "sentry.seer.workflows.breached_metrics.create_agentic_breached_metric_investigation",
                return_value=(notebook, True),
            ) as investigate,
        ):
            process_workflows(
                DelayedWorkflowClient(),
                WorkflowEventData(
                    event=group_event,
                    group=info.group,
                    group_state=GroupState(
                        id=info.group.id,
                        is_new=info.is_new,
                        is_regression=False,
                        is_new_group_environment=True,
                    ),
                ),
                group_event.datetime,
            )
        run = SeerWorkflowRun.objects.get(workflow_config=self.config)
        assert run.extras["snapshot"]["inputs"]["group_id"] == int(response.data["issueId"])
        investigate.assert_called_once()
        assert investigate.call_args.kwargs["resolved_source"].source["snapshot"]["monitor"][
            "id"
        ] == str(self.detector.id)
