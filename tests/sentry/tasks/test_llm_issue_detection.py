import uuid
from unittest.mock import Mock, patch

from pydantic import ValidationError as PydanticValidationError
from urllib3 import BaseHTTPResponse

from sentry.issues.grouptype import LLMDetectedExperimentalGroupType
from sentry.tasks.llm_issue_detection import (
    IssueDetectionResponse,
    detect_llm_issues_for_project,
    run_llm_issue_detection,
)
from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


@patch("sentry.tasks.llm_issue_detection.make_signed_seer_api_request")
class LLMIssueDetectionTest(APITransactionTestCase, SnubaTestCase, SpanTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    def _create_test_transaction_data(self):
        transaction_name = "test_transaction"
        trace_id = uuid.uuid4().hex

        spans = []
        for i in range(3):
            span = self.create_span(
                {
                    "description": f"span-{i}",
                    "sentry_tags": {"transaction": transaction_name},
                    "trace_id": trace_id,
                    "parent_span_id": None if i == 0 else f"parent-{i - 1}",
                    "is_segment": i == 0,
                },
                start_ts=self.ten_mins_ago,
            )
            spans.append(span)

        # Store spans in EAP (required for get_transactions_for_project and get_trace_for_transaction)
        self.store_spans(spans, is_eap=True)

        return spans, transaction_name, trace_id

    @patch("sentry.tasks.llm_issue_detection.detect_llm_issues_for_project.delay")
    def test_run_detection_dispatches_sub_tasks(self, mock_delay, *_):
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

    @patch("sentry.tasks.llm_issue_detection.IssueDetectionResponse.parse_obj")
    def test_detect_llm_issues_pydantic_validation_error_handling(
        self, mock_parse_obj, mock_seer_api
    ):
        """Test that Pydantic ValidationError is caught and doesn't crash the task."""
        self._create_test_transaction_data()
        mock_response = Mock(spec=BaseHTTPResponse)
        mock_response.status = 200
        mock_response.data = b'{"issues": []}'
        mock_response.json.return_value = {"issues": "something invalid"}
        mock_seer_api.return_value = mock_response

        mock_parse_obj.side_effect = PydanticValidationError([], IssueDetectionResponse)

        result = detect_llm_issues_for_project(self.project.id)

        assert mock_seer_api.called
        assert mock_parse_obj.called
        assert result is None

    @patch("sentry.tasks.llm_issue_detection.logger")
    def test_detect_llm_issues_success_with_logging(self, mock_logger, mock_seer_api):
        """Test successful issue detection with proper logging."""
        self._create_test_transaction_data()
        mock_response = Mock(spec=BaseHTTPResponse)
        mock_response.status = 200
        mock_response.data = b'{"issues": [{"title": "Test Issue", "explanation": "Test explanation", "impact": "High", "evidence": "Test evidence"}]}'
        mock_response.json.return_value = {
            "issues": [
                {
                    "title": "Test Issue",
                    "explanation": "Test explanation",
                    "impact": "High",
                    "evidence": "Test evidence",
                }
            ]
        }
        mock_seer_api.return_value = mock_response

        detect_llm_issues_for_project(self.project.id)

        success_log_calls = [
            call
            for call in mock_logger.info.call_args_list
            if "Seer issue detection success" in call[0]
        ]
        assert len(success_log_calls) > 0
        success_call = success_log_calls[0]
        log_extra = success_call[1]["extra"]
        assert log_extra["num_issues"] == 1
        assert "trace_id" in log_extra
        assert log_extra["project_id"] == self.project.id
        assert log_extra["titles"] == ["Test Issue"]

    def test_detect_llm_issues_no_transactions(self, mock_seer_api):
        """Test handling when no transactions are found."""
        # This should complete without errors (just no work done)
        detect_llm_issues_for_project(self.project.id)

        # Verify Seer API was never called since no transactions were found
        mock_seer_api.assert_not_called()

    def test_detect_llm_issues_no_traces(self, mock_seer_api):
        """Test handling when transactions exist but no traces are found."""
        self._create_test_transaction_data()

        with patch("sentry.tasks.llm_issue_detection.get_trace_for_transaction", return_value=None):
            detect_llm_issues_for_project(self.project.id)

        mock_seer_api.assert_not_called()

    @patch("sentry.tasks.llm_issue_detection.logger")
    def test_detect_llm_issues_multiple_transactions_partial_errors(
        self, mock_logger, mock_seer_api
    ):
        """Test that errors in some transactions don't block processing of others."""
        transaction1_name = "transaction_1"
        trace_id_1 = uuid.uuid4().hex
        spans1 = [
            self.create_span(
                {
                    "description": "span-1",
                    "sentry_tags": {"transaction": transaction1_name},
                    "trace_id": trace_id_1,
                    "parent_span_id": None,
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
            )
        ]

        transaction2_name = "transaction_2"
        trace_id_2 = uuid.uuid4().hex
        spans2 = [
            self.create_span(
                {
                    "description": "span-2",
                    "sentry_tags": {"transaction": transaction2_name},
                    "trace_id": trace_id_2,
                    "parent_span_id": None,
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
            )
        ]

        self.store_spans(spans1 + spans2, is_eap=True)

        error_response = Mock(spec=BaseHTTPResponse)
        error_response.status = 500
        error_response.data = b'{"error": "Internal server error"}'

        success_response = Mock(spec=BaseHTTPResponse)
        success_response.status = 200
        success_response.data = b'{"issues": [{"title": "Test Issue", "explanation": "Test explanation", "impact": "High", "evidence": "Test evidence"}]}'
        success_response.json.return_value = {
            "issues": [
                {
                    "title": "Test Issue",
                    "explanation": "Test explanation",
                    "impact": "High",
                    "evidence": "Test evidence",
                }
            ]
        }

        mock_seer_api.side_effect = [error_response, success_response]

        detect_llm_issues_for_project(self.project.id)

        assert mock_seer_api.call_count == 2
        success_log_calls = [
            call
            for call in mock_logger.info.call_args_list
            if "Seer issue detection success" in call[0]
        ]
        assert len(success_log_calls) == 1
        log_extra = success_log_calls[0][1]["extra"]
        assert log_extra["num_issues"] == 1
        assert log_extra["titles"] == ["Test Issue"]

    @patch("sentry.tasks.llm_issue_detection.random.sample")
    @patch("sentry.tasks.llm_issue_detection.produce_occurrence_to_kafka")
    @patch("sentry.tasks.llm_issue_detection.get_trace_for_transaction")
    @patch("sentry.tasks.llm_issue_detection.get_transactions_for_project")
    def test_creates_issue_occurrences_for_detected_issues(
        self,
        mock_get_transactions,
        mock_get_trace,
        mock_produce_occurrence,
        mock_random_sample,
        mock_seer_api,
    ):
        """
        Test that detected issues are properly converted to issue occurrences
        and sent to Kafka with correct structure.
        """
        transaction_name = "test_transaction"
        trace_id = uuid.uuid4().hex

        mock_transaction = Mock()
        mock_transaction.name = transaction_name
        mock_transaction.project_id = self.project.id
        mock_get_transactions.return_value = [mock_transaction]

        mock_random_sample.side_effect = lambda x, n: x

        mock_trace = Mock()
        mock_trace.trace_id = trace_id
        mock_trace.dict.return_value = {
            "trace_id": trace_id,
            "transaction": transaction_name,
            "spans": [],
        }
        mock_get_trace.return_value = mock_trace

        mock_response = Mock(spec=BaseHTTPResponse)
        mock_response.status = 200
        mock_response.json.return_value = {
            "issues": [
                {
                    "title": "Database Connection Pool Exhaustion",
                    "explanation": "Your application is running out of database connections",
                    "impact": "High - may cause request failures",
                    "evidence": "Connection pool at 95% capacity",
                    "missing_telemetry": "Database connection metrics",
                },
                {
                    "title": "Slow API Response",
                    "explanation": "External API calls taking longer than expected",
                    "impact": "Medium - affects user experience",
                    "evidence": "API response time > 2s",
                },
            ]
        }
        mock_seer_api.return_value = mock_response

        detect_llm_issues_for_project(self.project.id)

        # Verify produce_occurrence_to_kafka was called twice
        assert mock_produce_occurrence.call_count == 2

        # Verify first issue occurrence
        first_call = mock_produce_occurrence.call_args_list[0]
        assert first_call.kwargs["payload_type"].value == "occurrence"

        first_occurrence = first_call.kwargs["occurrence"]
        assert first_occurrence.type == LLMDetectedExperimentalGroupType
        assert first_occurrence.issue_title == "Database Connection Pool Exhaustion"
        assert (
            first_occurrence.subtitle == "Your application is running out of database connections"
        )
        assert first_occurrence.project_id == self.project.id
        assert first_occurrence.culprit == transaction_name
        assert first_occurrence.level == "warning"

        assert len(first_occurrence.fingerprint) == 1
        assert first_occurrence.fingerprint[0] == (
            f"llm-detected-Database Connection Pool Exhaustion-{transaction_name}"
        )

        assert first_occurrence.evidence_data["trace_id"] == trace_id
        assert first_occurrence.evidence_data["transaction"] == transaction_name
        assert (
            first_occurrence.evidence_data["explanation"]
            == "Your application is running out of database connections"
        )
        assert first_occurrence.evidence_data["impact"] == "High - may cause request failures"

        evidence_display = first_occurrence.evidence_display
        assert len(evidence_display) == 4

        explanation_evidence = next(e for e in evidence_display if e.name == "Explanation")
        assert explanation_evidence.important is True
        assert (
            explanation_evidence.value == "Your application is running out of database connections"
        )

        impact_evidence = next(e for e in evidence_display if e.name == "Impact")
        assert impact_evidence.important is False
        assert impact_evidence.value == "High - may cause request failures"

        missing_telemetry_evidence = next(
            e for e in evidence_display if e.name == "Missing Telemetry"
        )
        assert missing_telemetry_evidence.value == "Database connection metrics"

        first_event_data = first_call.kwargs["event_data"]
        assert first_event_data["project_id"] == self.project.id
        assert first_event_data["platform"] == "other"
        assert first_event_data["tags"]["trace_id"] == trace_id
        assert first_event_data["tags"]["transaction"] == transaction_name
        assert first_event_data["tags"]["llm_detected"] == "true"
        assert "event_id" in first_event_data
        assert "received" in first_event_data
        assert "timestamp" in first_event_data

        second_call = mock_produce_occurrence.call_args_list[1]
        second_occurrence = second_call.kwargs["occurrence"]
        assert second_occurrence.issue_title == "Slow API Response"
        assert second_occurrence.fingerprint[0] == (
            f"llm-detected-Slow API Response-{transaction_name}"
        )
        assert len(second_occurrence.evidence_display) == 3
