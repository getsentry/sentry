from unittest.mock import Mock, patch

from sentry.issues.grouptype import LLMDetectedExperimentalGroupType
from sentry.tasks.llm_issue_detection import (
    DetectedIssue,
    create_issue_occurrence_from_detection,
    detect_llm_issues_for_project,
    run_llm_issue_detection,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.utils import json


class LLMIssueDetectionTest(TestCase):
    @patch("sentry.tasks.llm_issue_detection.detect_llm_issues_for_project.delay")
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
    @patch("sentry.tasks.llm_issue_detection.get_transactions_for_project")
    def test_detect_llm_issues_no_transactions(self, mock_get_transactions):
        """Test that the task returns early when there are no transactions."""
        mock_get_transactions.return_value = []

        detect_llm_issues_for_project(self.project.id)

        mock_get_transactions.assert_called_once_with(
            self.project.id, limit=50, start_time_delta={"minutes": 30}
        )

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.get_trace_for_transaction")
    @patch("sentry.tasks.llm_issue_detection.get_transactions_for_project")
    @patch("sentry.tasks.llm_issue_detection.random.shuffle")
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

    @patch("sentry.tasks.llm_issue_detection.produce_occurrence_to_kafka")
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

    @patch("sentry.tasks.llm_issue_detection.produce_occurrence_to_kafka")
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
    @patch("sentry.tasks.llm_issue_detection.produce_occurrence_to_kafka")
    @patch("sentry.tasks.llm_issue_detection.make_signed_seer_api_request")
    @patch("sentry.tasks.llm_issue_detection.get_trace_for_transaction")
    @patch("sentry.tasks.llm_issue_detection.get_transactions_for_project")
    @patch("sentry.tasks.llm_issue_detection.random.sample")
    def test_detect_llm_issues_full_flow(
        self,
        mock_sample,
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
        mock_sample.side_effect = lambda x, n: x

        mock_trace = Mock()
        mock_trace.trace_id = "trace-abc-123"
        mock_trace.total_spans = 100
        mock_trace.dict.return_value = {
            "trace_id": "trace-abc-123",
            "spans": [{"op": "db.query", "duration": 1.5}],
        }
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
