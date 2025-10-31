from unittest.mock import Mock, patch

from sentry.issues.grouptype import LLMDetectedExperimentalGroupType
from sentry.tasks.llm_issue_detection import (
    DetectedIssue,
    create_issue_occurrence_from_detection,
    detect_llm_issues_for_project,
    run_llm_issue_detection,
)
from sentry.testutils.cases import TestCase


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

    @patch("sentry.tasks.llm_issue_detection.get_transactions_for_project")
    def test_detect_llm_issues_no_transactions(self, mock_get_transactions):
        mock_get_transactions.return_value = []

        detect_llm_issues_for_project(self.project.id)

    @patch("sentry.tasks.llm_issue_detection.get_trace_for_transaction")
    @patch("sentry.tasks.llm_issue_detection.get_transactions_for_project")
    @patch("sentry.tasks.llm_issue_detection.random.sample")
    def test_detect_llm_issues_no_traces(self, mock_sample, mock_get_transactions, mock_get_trace):
        mock_transaction = Mock()
        mock_transaction.name = "test_tx"
        mock_transaction.project_id = self.project.id
        mock_get_transactions.return_value = [mock_transaction]
        mock_sample.side_effect = lambda x, n: x
        mock_get_trace.return_value = None

        detect_llm_issues_for_project(self.project.id)

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
            == "llm-detected-Database Connection Pool Exhaustion-test_transaction"
        )

        assert occurrence.evidence_data["trace_id"] == "abc123xyz"
        assert occurrence.evidence_data["transaction"] == "test_transaction"
        assert (
            occurrence.evidence_data["explanation"]
            == "Your application is running out of database connections"
        )
        assert occurrence.evidence_data["impact"] == "High - may cause request failures"

        evidence_display = occurrence.evidence_display
        assert len(evidence_display) == 4

        explanation_evidence = next(e for e in evidence_display if e.name == "Explanation")
        assert explanation_evidence.important is True
        assert (
            explanation_evidence.value == "Your application is running out of database connections"
        )

        impact_evidence = next(e for e in evidence_display if e.name == "Impact")
        assert impact_evidence.important is False
        assert impact_evidence.value == "High - may cause request failures"

        evidence_evidence = next(e for e in evidence_display if e.name == "Evidence")
        assert evidence_evidence.value == "Connection pool at 95% capacity"

        missing_telemetry_evidence = next(
            e for e in evidence_display if e.name == "Missing Telemetry"
        )
        assert missing_telemetry_evidence.value == "Database connection metrics"

        event_data = call_kwargs["event_data"]
        assert event_data["project_id"] == self.project.id
        assert event_data["platform"] == "other"
        assert event_data["tags"]["trace_id"] == "abc123xyz"
        assert event_data["tags"]["transaction"] == "test_transaction"
        assert event_data["tags"]["llm_detected"] == "true"
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
