import uuid
from datetime import datetime, timedelta
from typing import Any
from unittest import mock

import pytest

from sentry.autopilot.tasks.common import AutopilotDetectorName
from sentry.autopilot.tasks.trace_instrumentation import (
    InstrumentationIssueCategory,
    TraceInstrumentationFinishReason,
    TraceInstrumentationIssue,
    TraceInstrumentationResult,
    run_trace_instrumentation_detector_for_organization,
    run_trace_instrumentation_detector_for_project_task,
    sample_trace_for_instrumentation_analysis,
)
from sentry.constants import ObjectStatus
from sentry.seer.models import SeerPermissionError
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class TestRunTraceInstrumentationDetectorForOrganization(TestCase):
    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.trace_instrumentation.run_trace_instrumentation_detector_for_project_task.apply_async"
    )
    def test_spawns_task_for_active_projects(self, mock_apply_async: mock.MagicMock) -> None:
        active_project = self.create_project(organization=self.organization)
        self.create_project(organization=self.organization, status=ObjectStatus.PENDING_DELETION)

        run_trace_instrumentation_detector_for_organization(self.organization)

        # Should only spawn task for active project
        assert mock_apply_async.call_count == 1
        mock_apply_async.assert_called_once_with(
            args=(self.organization.id, active_project.id),
            headers={"sentry-propagate-traces": False},
        )

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.trace_instrumentation.run_trace_instrumentation_detector_for_project_task.apply_async"
    )
    def test_spawns_tasks_for_multiple_projects(self, mock_apply_async: mock.MagicMock) -> None:
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        run_trace_instrumentation_detector_for_organization(self.organization)

        # Should spawn task for each project
        assert mock_apply_async.call_count == 3
        spawned_project_ids = {call[1]["args"][1] for call in mock_apply_async.call_args_list}
        assert spawned_project_ids == {project1.id, project2.id, project3.id}


class TraceSpanTestMixin(SpanTestCase, SnubaTestCase):
    """Mixin providing helper methods for creating and storing trace spans."""

    ten_mins_ago: datetime

    def _create_trace_with_spans(
        self, trace_id: str, transaction_name: str, span_count: int = 25
    ) -> list[dict[str, Any]]:
        """Helper to create and store a trace with the specified number of spans.

        Creates enough spans (default 25) to meet the minimum span count requirement (20-500)
        for trace sampling.
        """
        spans: list[dict[str, Any]] = []
        for i in range(span_count):
            span = self.create_span(
                {
                    "description": f"span-{i}" if i > 0 else transaction_name,
                    "sentry_tags": {
                        "transaction": transaction_name,
                        "op": "http.server" if i == 0 else "db.query",
                    },
                    "trace_id": trace_id,
                    "parent_span_id": None if i == 0 else spans[0]["span_id"],
                    "is_segment": i == 0,
                },
                start_ts=self.ten_mins_ago + timedelta(seconds=i),
            )
            spans.append(span)

        self.store_spans(spans)
        return spans


class TestSampleTraceForInstrumentationAnalysis(TestCase, TraceSpanTestMixin):
    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    @pytest.mark.django_db
    def test_returns_none_when_no_traces_found(self) -> None:
        # No spans stored, so no traces should be found
        result = sample_trace_for_instrumentation_analysis(self.project)
        assert result is None

    @pytest.mark.django_db
    def test_returns_first_trace_when_found(self) -> None:
        trace_id = uuid.uuid4().hex
        transaction_name = "GET /api/users"

        self._create_trace_with_spans(trace_id, transaction_name)

        result = sample_trace_for_instrumentation_analysis(self.project)

        assert result is not None
        assert result.trace_id == trace_id


class TestRunTraceInstrumentationDetectorForProject(TestCase, TraceSpanTestMixin):
    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.trace_instrumentation.SeerExplorerClient")
    def test_skips_llm_for_nonexistent_organization(self, mock_seer_client: mock.MagicMock) -> None:
        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=999999,
            project_id=self.project.id,
        )
        assert result is None
        assert not mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.trace_instrumentation.SeerExplorerClient")
    def test_skips_llm_for_nonexistent_project(self, mock_seer_client: mock.MagicMock) -> None:
        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=999999,
        )
        assert result is None
        assert not mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.trace_instrumentation.SeerExplorerClient")
    def test_skips_llm_when_no_trace_sampled(
        self,
        mock_seer_client: mock.MagicMock,
    ) -> None:
        # No spans stored, so sample_trace_for_instrumentation_analysis returns None
        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        assert result is None
        assert not mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.trace_instrumentation.SeerExplorerClient")
    @mock.patch("sentry.autopilot.tasks.trace_instrumentation.get_trace_waterfall")
    def test_skips_llm_when_trace_query_fails(
        self,
        mock_get_waterfall: mock.MagicMock,
        mock_seer_client: mock.MagicMock,
    ) -> None:
        trace_id = uuid.uuid4().hex
        transaction_name = "GET /api/users"
        self._create_trace_with_spans(trace_id, transaction_name)

        # Mock get_trace_waterfall to raise an exception
        mock_get_waterfall.side_effect = Exception("Query failed")

        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        assert result is None
        assert not mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.trace_instrumentation.SeerExplorerClient")
    def test_handles_missing_seer_access(
        self,
        mock_seer_client: mock.MagicMock,
    ) -> None:
        trace_id = uuid.uuid4().hex
        transaction_name = "GET /api/users"
        self._create_trace_with_spans(trace_id, transaction_name)

        mock_seer_client.side_effect = SeerPermissionError("Access denied")

        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        assert result is None
        assert mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.trace_instrumentation.create_instrumentation_issue")
    @mock.patch("sentry.autopilot.tasks.trace_instrumentation.SeerExplorerClient")
    def test_creates_issues_for_instrumentation_gaps(
        self,
        mock_seer_client: mock.MagicMock,
        mock_create_issue: mock.MagicMock,
    ) -> None:
        trace_id = uuid.uuid4().hex
        transaction_name = "GET /api/users"
        self._create_trace_with_spans(trace_id, transaction_name)

        # Mock Seer client to return instrumentation issues
        mock_client_instance = mock.MagicMock()
        mock_client_instance.start_run.return_value = 123
        mock_state = mock.MagicMock()
        mock_state.status = "completed"
        mock_state.blocks = []

        issue1 = TraceInstrumentationIssue(
            explanation="Database queries are not instrumented with db.* spans",
            impact="Cannot identify slow queries or N+1 problems",
            evidence="Time gap of 250ms between spans span1 and span2",
            offender_span_ids=["span1", "span2"],
            missing_telemetry="Add db.query spans for database operations",
            title="Missing Database Instrumentation",
            category=InstrumentationIssueCategory.MISSING_INSTRUMENTATION,
            subcategory="Missing Database Spans",
        )
        issue2 = TraceInstrumentationIssue(
            explanation="HTTP requests to external APIs lack http.* spans",
            impact="External dependency performance cannot be tracked",
            evidence="Parent span duration suggests external calls at span3",
            offender_span_ids=["span3"],
            missing_telemetry="Add http.client spans for external API calls",
            title="Missing HTTP Instrumentation",
            category=InstrumentationIssueCategory.MISSING_INSTRUMENTATION,
            subcategory="Missing HTTP Spans",
        )

        mock_state.get_artifact.return_value = TraceInstrumentationResult(
            issues=[issue1, issue2],
            finish_reason=TraceInstrumentationFinishReason.SUCCESS,
        )
        mock_client_instance.get_run.return_value = mock_state
        mock_seer_client.return_value = mock_client_instance

        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        # Should return the list of issues
        assert result is not None
        assert len(result) == 2
        assert result[0].title == "Missing Database Instrumentation"
        assert result[1].title == "Missing HTTP Instrumentation"

        # Verify Seer client was called correctly
        assert mock_client_instance.start_run.call_count == 1
        call_kwargs = mock_client_instance.start_run.call_args[1]
        assert call_kwargs.get("artifact_key") == "issues"
        assert call_kwargs.get("artifact_schema") == TraceInstrumentationResult

        # Verify prompt includes project context and trace data
        prompt = mock_client_instance.start_run.call_args[0][0]
        assert self.project.slug in prompt
        assert "DETECTION CRITERIA" in prompt
        assert transaction_name in prompt

        # Verify issues were created
        assert mock_create_issue.call_count == 2

        # Check first issue
        call_args_list = [call[1] for call in mock_create_issue.call_args_list]
        assert call_args_list[0]["project_id"] == self.project.id
        assert call_args_list[0]["detector_name"] == AutopilotDetectorName.TRACE_INSTRUMENTATION
        assert call_args_list[0]["title"] == "Missing Database Instrumentation"
        assert call_args_list[0]["subtitle"] == "Missing Database Spans"
        assert "Database queries are not instrumented" in call_args_list[0]["description"]
        assert "span1, span2" in call_args_list[0]["description"]

        # Check second issue
        assert call_args_list[1]["title"] == "Missing HTTP Instrumentation"
        assert call_args_list[1]["subtitle"] == "Missing HTTP Spans"

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.trace_instrumentation.SeerExplorerClient")
    def test_handles_seer_explorer_error_gracefully(
        self,
        mock_seer_client: mock.MagicMock,
    ) -> None:
        trace_id = uuid.uuid4().hex
        transaction_name = "GET /api/users"
        self._create_trace_with_spans(trace_id, transaction_name)

        # Mock client to raise error on start_run
        mock_client_instance = mock.MagicMock()
        mock_client_instance.start_run.side_effect = Exception("API error")
        mock_seer_client.return_value = mock_client_instance

        # Should not raise, just return None
        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
        )
        assert result is None
