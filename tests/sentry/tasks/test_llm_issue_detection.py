import uuid
from datetime import timedelta
from unittest.mock import Mock, patch

from sentry.issues.grouptype import LLMDetectedExperimentalGroupType
from sentry.seer.sentry_data_models import EvidenceSpan, EvidenceTraceData
from sentry.tasks.llm_issue_detection import (
    DetectedIssue,
    create_issue_occurrence_from_detection,
    detect_llm_issues_for_project,
    run_llm_issue_detection,
)
from sentry.tasks.llm_issue_detection.trace_data import get_evidence_trace_for_llm_detection
from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.utils import json


class LLMIssueDetectionTest(TestCase):
    @patch("sentry.tasks.llm_issue_detection.detection.detect_llm_issues_for_project.delay")
    def test_run_detection_dispatches_sub_tasks(self, mock_delay):
        """Test run_detection spawns sub-tasks for each project."""
        project = self.create_project()

        with self.options(
            {
                "issue-detection.llm-detection.enabled": True,
                "issue-detection.llm-detection.projects-allowlist": [project.id],
            }
        ):
            run_llm_issue_detection()

        assert mock_delay.called
        assert mock_delay.call_args[0][0] == project.id

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.get_transactions_for_project")
    def test_detect_llm_issues_no_transactions(self, mock_get_transactions):
        """Test that the task returns early when there are no transactions."""
        mock_get_transactions.return_value = []

        detect_llm_issues_for_project(self.project.id)

        mock_get_transactions.assert_called_once_with(
            self.project.id, limit=50, start_time_delta={"minutes": 30}
        )

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.get_evidence_trace_for_llm_detection")
    @patch("sentry.tasks.llm_issue_detection.detection.get_transactions_for_project")
    @patch("sentry.tasks.llm_issue_detection.detection.random.shuffle")
    def test_detect_llm_issues_no_traces(self, mock_shuffle, mock_get_transactions, mock_get_trace):
        """Test that the task continues gracefully when traces can't be fetched."""
        mock_transaction = Mock()
        mock_transaction.name = "test_tx"
        mock_transaction.project_id = self.project.id
        mock_get_transactions.return_value = [mock_transaction]
        mock_shuffle.return_value = None  # shuffle modifies in place
        mock_get_trace.return_value = None

        detect_llm_issues_for_project(self.project.id)

        mock_get_trace.assert_called_once_with(mock_transaction.name, mock_transaction.project_id)

    @patch("sentry.tasks.llm_issue_detection.detection.produce_occurrence_to_kafka")
    def test_create_issue_occurrence_from_detection(self, mock_produce_occurrence):
        detected_issue = DetectedIssue(
            title="Database Connection Pool Exhaustion",
            explanation="Your application is running out of database connections",
            impact="High - may cause request failures",
            evidence="Connection pool at 95% capacity",
            missing_telemetry="Database connection metrics",
        )

        mock_trace = Mock()
        mock_trace.trace_id = "abc123xyz"

        create_issue_occurrence_from_detection(
            detected_issue=detected_issue,
            trace=mock_trace,
            project_id=self.project.id,
            transaction_name="test_transaction",
        )

        assert mock_produce_occurrence.called
        call_kwargs = mock_produce_occurrence.call_args.kwargs

        assert call_kwargs["payload_type"].value == "occurrence"

        occurrence = call_kwargs["occurrence"]
        assert occurrence.type == LLMDetectedExperimentalGroupType
        assert occurrence.issue_title == "Database Connection Pool Exhaustion"
        assert occurrence.subtitle == "Your application is running out of database connections"
        assert occurrence.project_id == self.project.id
        assert occurrence.culprit == "test_transaction"
        assert occurrence.level == "warning"

        assert len(occurrence.fingerprint) == 1
        assert (
            occurrence.fingerprint[0]
            == "llm-detected-database-connection-pool-exhaustion-test_transaction"
        )

        assert occurrence.evidence_data["trace_id"] == "abc123xyz"
        assert occurrence.evidence_data["transaction"] == "test_transaction"
        assert (
            occurrence.evidence_data["explanation"]
            == "Your application is running out of database connections"
        )
        assert occurrence.evidence_data["impact"] == "High - may cause request failures"

        evidence_display = occurrence.evidence_display
        assert len(evidence_display) == 3

        assert evidence_display[0].name == "Explanation"
        assert (
            evidence_display[0].value == "Your application is running out of database connections"
        )
        assert evidence_display[1].name == "Impact"
        assert evidence_display[1].value == "High - may cause request failures"
        assert evidence_display[2].name == "Evidence"
        assert evidence_display[2].value == "Connection pool at 95% capacity"

        event_data = call_kwargs["event_data"]
        assert event_data["project_id"] == self.project.id
        assert event_data["platform"] == "other"
        assert event_data["contexts"]["trace"]["trace_id"] == "abc123xyz"
        assert "event_id" in event_data
        assert "received" in event_data
        assert "timestamp" in event_data

    @patch("sentry.tasks.llm_issue_detection.detection.produce_occurrence_to_kafka")
    def test_create_issue_occurrence_without_missing_telemetry(self, mock_produce_occurrence):
        detected_issue = DetectedIssue(
            title="Slow API Response",
            explanation="API calls taking too long",
            impact="Medium",
            evidence="Response time > 2s",
        )

        mock_trace = Mock()
        mock_trace.trace_id = "xyz789"

        create_issue_occurrence_from_detection(
            detected_issue=detected_issue,
            trace=mock_trace,
            project_id=self.project.id,
            transaction_name="api_endpoint",
        )

        occurrence = mock_produce_occurrence.call_args.kwargs["occurrence"]

        assert len(occurrence.evidence_display) == 3

        evidence_names = {e.name for e in occurrence.evidence_display}
        assert evidence_names == {"Explanation", "Impact", "Evidence"}

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.produce_occurrence_to_kafka")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    @patch("sentry.tasks.llm_issue_detection.detection.get_evidence_trace_for_llm_detection")
    @patch("sentry.tasks.llm_issue_detection.detection.get_transactions_for_project")
    @patch("sentry.tasks.llm_issue_detection.detection.random.shuffle")
    def test_detect_llm_issues_full_flow(
        self,
        mock_shuffle,
        mock_get_transactions,
        mock_get_trace,
        mock_seer_request,
        mock_produce_occurrence,
    ):
        """Test the full detect_llm_issues_for_project flow with Seer API interaction."""
        mock_transaction = Mock()
        mock_transaction.name = "api/users/list"
        mock_transaction.project_id = self.project.id
        mock_get_transactions.return_value = [mock_transaction]
        mock_shuffle.return_value = None

        mock_span = EvidenceSpan(
            span_id="span123",
            parent_span_id=None,
            op="db.query",
            description="SELECT * FROM users",
            exclusive_time=150.5,
            data={
                "duration": 200.0,
                "status": "ok",
            },
        )

        mock_trace = EvidenceTraceData(
            trace_id="trace-abc-123",
            project_id=self.project.id,
            transaction_name="api/users/list",
            total_spans=100,
            spans=[mock_span],
        )
        mock_get_trace.return_value = mock_trace

        seer_response_data = {
            "issues": [
                {
                    "title": "N+1 Query Detected",
                    "explanation": "Multiple sequential database queries detected in loop",
                    "impact": "High - causes performance degradation",
                    "evidence": "15 queries executed sequentially",
                    "missing_telemetry": "Database query attribution",
                },
                {
                    "title": "Memory Leak Risk",
                    "explanation": "Large object allocations without cleanup",
                    "impact": "Medium - may cause OOM",
                    "evidence": "Objects not released after use",
                    "missing_telemetry": None,
                },
            ]
        }

        mock_response = Mock()
        mock_response.status = 200
        mock_response.json.return_value = seer_response_data
        mock_seer_request.return_value = mock_response

        detect_llm_issues_for_project(self.project.id)

        assert mock_seer_request.called
        seer_call_kwargs = mock_seer_request.call_args.kwargs
        assert seer_call_kwargs["path"] == "/v1/automation/issue-detection/analyze"

        request_body = json.loads(seer_call_kwargs["body"].decode("utf-8"))
        assert request_body["project_id"] == self.project.id
        assert request_body["organization_id"] == self.project.organization_id
        assert len(request_body["telemetry"]) == 1
        assert request_body["telemetry"][0]["kind"] == "trace"
        assert request_body["telemetry"][0]["trace_id"] == "trace-abc-123"

        assert mock_produce_occurrence.call_count == 2

        first_occurrence = mock_produce_occurrence.call_args_list[0].kwargs["occurrence"]
        assert first_occurrence.type == LLMDetectedExperimentalGroupType
        assert first_occurrence.issue_title == "N+1 Query Detected"
        assert first_occurrence.culprit == "api/users/list"
        assert first_occurrence.project_id == self.project.id
        assert len(first_occurrence.evidence_display) == 3

        second_occurrence = mock_produce_occurrence.call_args_list[1].kwargs["occurrence"]
        assert second_occurrence.issue_title == "Memory Leak Risk"
        assert len(second_occurrence.evidence_display) == 3


class TestGetEvidenceTraceForLLMDetection(APITransactionTestCase, SnubaTestCase, SpanTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    def test_get_evidence_trace_for_llm_detection(self) -> None:
        transaction_name = "api/users/profile"

        # Create multiple traces with different span counts
        traces_data = [
            (5, "trace-medium", 0),
            (2, "trace-small", 10),
            (8, "trace-large", 20),
        ]

        spans = []
        trace_ids = []
        expected_trace_id = None

        for span_count, trace_suffix, start_offset_minutes in traces_data:
            trace_id = uuid.uuid4().hex
            trace_ids.append(trace_id)
            if trace_suffix == "trace-medium":
                expected_trace_id = trace_id

            for i in range(span_count):
                span = self.create_span(
                    {
                        "description": f"span-{i}-{trace_suffix}",
                        "sentry_tags": {"transaction": transaction_name},
                        "trace_id": trace_id,
                        "parent_span_id": None if i == 0 else f"parent-{i-1}",
                        "is_segment": i == 0,
                    },
                    start_ts=self.ten_mins_ago + timedelta(minutes=start_offset_minutes + i),
                )
                spans.append(span)

        self.store_spans(spans, is_eap=True)

        # Call the LLM detection function
        result = get_evidence_trace_for_llm_detection(transaction_name, self.project.id)

        # Verify basic structure
        assert result is not None
        assert result.transaction_name == transaction_name
        assert result.project_id == self.project.id
        assert result.trace_id in trace_ids
        assert result.trace_id == expected_trace_id
        assert result.total_spans == 5
        assert len(result.spans) == 5

        # Verify it's EvidenceTraceData with EvidenceSpan objects
        assert isinstance(result, EvidenceTraceData)
        for result_span in result.spans:
            assert isinstance(result_span, EvidenceSpan)
            assert result_span.span_id is not None
            assert result_span.description is not None
            assert result_span.description.startswith("span-")
            assert "trace-medium" in result_span.description
            assert hasattr(result_span, "op")
            assert hasattr(result_span, "exclusive_time")
            assert hasattr(result_span, "data")
            assert result_span.data is not None
            assert "duration" in result_span.data
            assert "status" in result_span.data

        # Verify parent-child relationships are preserved
        root_spans = [s for s in result.spans if s.parent_span_id is None]
        assert len(root_spans) == 1
