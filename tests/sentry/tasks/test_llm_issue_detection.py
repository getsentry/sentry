import uuid
from unittest.mock import Mock, patch

import pytest
from urllib3 import BaseHTTPResponse

from sentry.tasks.llm_issue_detection import (
    LLMIssueDetectionError,
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

    def test_detect_llm_issues_http_error(self, mock_seer_api):
        """Test HTTP error handling with proper exception fields."""
        self._create_test_transaction_data()
        mock_response = Mock(spec=BaseHTTPResponse)
        mock_response.status = 500
        mock_response.data = b'{"error": "Internal server error"}'
        mock_seer_api.return_value = mock_response

        with pytest.raises(LLMIssueDetectionError) as exc_info:
            detect_llm_issues_for_project(self.project.id)

        exception = exc_info.value
        assert exception.message == "Seer HTTP error"
        assert exception.status == 500
        assert exception.project_id == self.project.id
        assert exception.trace_id is not None
        assert exception.response_data == '{"error": "Internal server error"}'
        assert exception.error_message is None

    def test_detect_llm_issues_parsing_error(self, mock_seer_api):
        """Test response parsing error handling with error_message field."""
        self._create_test_transaction_data()
        mock_response = Mock(spec=BaseHTTPResponse)
        mock_response.status = 200
        mock_response.data = b"invalid json"
        mock_response.json.side_effect = ValueError("Expecting value: line 1 column 1 (char 0)")
        mock_seer_api.return_value = mock_response

        with pytest.raises(LLMIssueDetectionError) as exc_info:
            detect_llm_issues_for_project(self.project.id)

        exception = exc_info.value
        assert exception.message == "Seer response parsing error"
        assert exception.status == 200
        assert exception.project_id == self.project.id
        assert exception.trace_id is not None
        assert exception.response_data == "invalid json"
        assert "Expecting value" in exception.error_message

    def test_detect_llm_issues_invalid_schema(self, mock_seer_api):
        """Test Pydantic validation error handling."""
        self._create_test_transaction_data()
        mock_response = Mock(spec=BaseHTTPResponse)
        mock_response.status = 200
        mock_response.data = b'{"wrong_field": "value"}'
        mock_response.json.return_value = {"wrong_field": "value"}
        mock_seer_api.return_value = mock_response

        with pytest.raises(LLMIssueDetectionError) as exc_info:
            detect_llm_issues_for_project(self.project.id)

        exception = exc_info.value
        assert exception.message == "Seer response parsing error"
        assert exception.status == 200
        assert exception.project_id == self.project.id
        assert exception.trace_id is not None
        assert exception.response_data == '{"wrong_field": "value"}'
        assert exception.error_message is not None

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

    def test_detect_llm_issues_no_transactions(self, mock_seer_api):
        """Test handling when no transactions are found."""
        # This should complete without errors (just no work done)
        detect_llm_issues_for_project(self.project.id)

        # Verify Seer API was never called since no transactions were found
        mock_seer_api.assert_not_called()

    def test_detect_llm_issues_no_traces(self, mock_seer_api):
        """Test handling when transactions exist but no traces are found."""
        # Create some transaction data but mock get_trace_for_transaction to return None
        self._create_test_transaction_data()

        with patch("sentry.tasks.llm_issue_detection.get_trace_for_transaction", return_value=None):
            # This should complete without errors and not call Seer API
            detect_llm_issues_for_project(self.project.id)

        # Verify Seer API was never called since no traces were found
        mock_seer_api.assert_not_called()
