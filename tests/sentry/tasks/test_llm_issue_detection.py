import uuid
from datetime import timedelta
from unittest.mock import Mock, patch

from sentry.issues.grouptype import LLMDetectedExperimentalGroupType
from sentry.tasks.llm_issue_detection import (
    DetectedIssue,
    create_issue_occurrence_from_detection,
    detect_llm_issues_for_project,
    run_llm_issue_detection,
)
from sentry.tasks.llm_issue_detection.detection import (
    START_TIME_DELTA_MINUTES,
    TRANSACTION_BATCH_SIZE,
)
from sentry.tasks.llm_issue_detection.trace_data import (
    get_project_top_transaction_traces_for_llm_detection,
)
from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.utils import json


class LLMIssueDetectionTest(TestCase):
    @patch("sentry.tasks.llm_issue_detection.detection.detect_llm_issues_for_project.apply_async")
    def test_run_detection_dispatches_sub_tasks(self, mock_apply_async):
        """Test run_detection spawns sub-tasks for each project."""
        project = self.create_project()

        with self.options(
            {
                "issue-detection.llm-detection.enabled": True,
                "issue-detection.llm-detection.projects-allowlist": [project.id],
            }
        ):
            run_llm_issue_detection()

        mock_apply_async.assert_called_once_with(args=[project.id], countdown=0)

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    @patch(
        "sentry.tasks.llm_issue_detection.detection.get_project_top_transaction_traces_for_llm_detection"
    )
    def test_detect_llm_issues_no_transactions(self, mock_get_transactions, mock_seer_request):
        """Test that the task returns early when there are no transactions."""
        mock_get_transactions.return_value = []

        detect_llm_issues_for_project(self.project.id)

        mock_get_transactions.assert_called_once_with(
            self.project.id,
            limit=TRANSACTION_BATCH_SIZE,
            start_time_delta_minutes=START_TIME_DELTA_MINUTES,
        )
        mock_seer_request.assert_not_called()

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.trace_data.Spans.run_table_query")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    def test_detect_llm_issues_no_traces(self, mock_seer_request, mock_spans_query):
        """Test that the task returns early when traces can't be fetched for top transactions."""
        mock_spans_query.side_effect = [
            # First call: Return a transaction
            {
                "data": [{"transaction": "transaction_name", "sum(span.duration)": 1000}],
                "meta": {},
            },
            # Second call (trace query): return empty
            {"data": [], "meta": {}},
        ]

        detect_llm_issues_for_project(self.project.id)

        mock_seer_request.assert_not_called()

    @patch("sentry.tasks.llm_issue_detection.detection.produce_occurrence_to_kafka")
    def test_create_issue_occurrence_from_detection(self, mock_produce_occurrence):
        detected_issue = DetectedIssue(
            title="Database Connection Pool Exhaustion",
            explanation="Your application is running out of database connections",
            impact="High - may cause request failures",
            evidence="Connection pool at 95% capacity",
            missing_telemetry="Database connection metrics",
            offender_span_ids=["span_1", "span_2"],
            trace_id="abc123xyz",
            transaction_name="test_transaction",
            subcategory="Connection Pool Exhaustion",
            category="Database",
            verification_reason="Problem is correctly identified",
        )

        create_issue_occurrence_from_detection(
            detected_issue=detected_issue,
            project_id=self.project.id,
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

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.produce_occurrence_to_kafka")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    @patch("sentry.tasks.llm_issue_detection.trace_data.Spans.run_table_query")
    @patch("sentry.tasks.llm_issue_detection.detection.random.shuffle")
    def test_detect_llm_issues_full_flow(
        self,
        mock_shuffle,
        mock_spans_query,
        mock_seer_request,
        mock_produce_occurrence,
    ):
        """Test the full detect_llm_issues_for_project flow with Seer API interaction."""
        mock_shuffle.return_value = None  # shuffles in-place, mock to block from changing order

        mock_spans_query.side_effect = [
            # First call: transaction spans
            {
                "data": [
                    {"transaction": "POST /some/thing", "sum(span.duration)": 1007},
                    {"transaction": "GET /another/", "sum(span.duration)": 1003},
                ],
                "meta": {},
            },
            # Second call: trace for transaction 1
            {
                "data": [
                    {"trace": "trace_id_1", "precise.start_ts": 1234},
                ],
                "meta": {},
            },
            # Third call: trace for transaction 2
            {
                "data": [
                    {"trace": "trace_id_2", "precise.start_ts": 1234},
                ],
                "meta": {},
            },
        ]

        seer_response_data = {
            "issues": [
                {
                    "title": "N+1 Query Detected",
                    "explanation": "Multiple sequential database queries detected in loop",
                    "impact": "High - causes performance degradation",
                    "evidence": "15 queries executed sequentially",
                    "missing_telemetry": "Database query attribution",
                    "offender_span_ids": ["span_1", "span_2"],
                    "trace_id": "trace_id_1",
                    "transaction_name": "POST /some/thing",
                    "category": "Database",
                    "subcategory": "N+1 Query",
                    "verification_reason": "Problem is correctly identified",
                },
                {
                    "title": "Memory Leak Risk",
                    "explanation": "Large object allocations without cleanup",
                    "impact": "Medium - may cause OOM",
                    "evidence": "Objects not released after use",
                    "missing_telemetry": None,
                    "offender_span_ids": ["span_3"],
                    "trace_id": "trace_id_2",
                    "transaction_name": "GET /another/",
                    "category": "Memory",
                    "subcategory": "Memory Leak",
                    "verification_reason": "Problem is correctly identified",
                },
            ],
            "traces_analyzed": 1,
        }

        mock_response_with_2_issues = Mock()
        mock_response_with_2_issues.status = 200
        mock_response_with_2_issues.json.return_value = seer_response_data
        mock_response_with_no_issues = Mock()
        mock_response_with_no_issues.status = 200
        mock_response_with_no_issues.json.return_value = {"issues": [], "traces_analyzed": 1}
        mock_seer_request.side_effect = [mock_response_with_2_issues, mock_response_with_no_issues]

        detect_llm_issues_for_project(self.project.id)

        assert mock_spans_query.call_count == 3  # 1 for transactions, 2 for traces
        assert mock_seer_request.call_count == 2  # 1 per trace

        first_seer_call = mock_seer_request.call_args_list[0].kwargs
        assert first_seer_call["path"] == "/v1/automation/issue-detection/analyze"
        first_request_body = json.loads(first_seer_call["body"].decode("utf-8"))
        assert first_request_body["project_id"] == self.project.id
        assert first_request_body["organization_id"] == self.project.organization_id
        assert len(first_request_body["traces"]) == 1
        assert first_request_body["traces"][0]["trace_id"] == "trace_id_1"
        assert first_request_body["traces"][0]["transaction_name"] == "POST /some/thing"

        second_seer_call = mock_seer_request.call_args_list[1].kwargs
        assert second_seer_call["path"] == "/v1/automation/issue-detection/analyze"
        second_request_body = json.loads(second_seer_call["body"].decode("utf-8"))
        assert second_request_body["project_id"] == self.project.id
        assert second_request_body["organization_id"] == self.project.organization_id
        assert len(second_request_body["traces"]) == 1
        assert second_request_body["traces"][0]["trace_id"] == "trace_id_2"
        assert second_request_body["traces"][0]["transaction_name"] == "GET /another/"

        assert mock_produce_occurrence.call_count == 2

        first_occurrence = mock_produce_occurrence.call_args_list[0].kwargs["occurrence"]
        assert first_occurrence.type == LLMDetectedExperimentalGroupType
        assert first_occurrence.issue_title == "N+1 Query Detected"
        assert first_occurrence.culprit == "POST /some/thing"
        assert first_occurrence.project_id == self.project.id
        assert len(first_occurrence.evidence_display) == 3

        second_occurrence = mock_produce_occurrence.call_args_list[1].kwargs["occurrence"]
        assert second_occurrence.issue_title == "Memory Leak Risk"
        assert len(second_occurrence.evidence_display) == 3

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.produce_occurrence_to_kafka")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    @patch("sentry.tasks.llm_issue_detection.trace_data.Spans.run_table_query")
    @patch("sentry.tasks.llm_issue_detection.detection.random.shuffle")
    @patch("sentry.tasks.llm_issue_detection.detection.logger.error")
    def test_detect_llm_issues_continues_on_seer_error(
        self,
        mock_logger_error,
        mock_shuffle,
        mock_spans_query,
        mock_seer_request,
        mock_produce_occurrence,
    ):
        mock_shuffle.return_value = None

        mock_spans_query.side_effect = [
            {
                "data": [
                    {"transaction": "POST /some/thing", "sum(span.duration)": 1007},
                    {"transaction": "GET /another/", "sum(span.duration)": 1003},
                ],
                "meta": {},
            },
            {"data": [{"trace": "trace_id_1", "precise.start_ts": 1234}], "meta": {}},
            {"data": [{"trace": "trace_id_2", "precise.start_ts": 1235}], "meta": {}},
        ]

        mock_error_response = Mock()
        mock_error_response.status = 500
        mock_error_response.data.decode.return_value = "Internal Server Error"

        mock_success_response = Mock()
        mock_success_response.status = 200
        mock_success_response.json.return_value = {
            "issues": [
                {
                    "title": "Success Issue",
                    "explanation": "This one worked",
                    "impact": "Low",
                    "evidence": "All good",
                    "missing_telemetry": None,
                    "offender_span_ids": ["span_1"],
                    "trace_id": "trace_id_2",
                    "transaction_name": "GET /another/",
                    "category": "General",
                    "subcategory": "Success",
                    "verification_reason": "Problem is correctly identified",
                }
            ],
            "traces_analyzed": 1,
        }

        mock_seer_request.side_effect = [mock_error_response, mock_success_response]

        detect_llm_issues_for_project(self.project.id)

        assert mock_seer_request.call_count == 2
        assert mock_logger_error.call_count == 1
        assert mock_produce_occurrence.call_count == 1

        occurrence = mock_produce_occurrence.call_args.kwargs["occurrence"]
        assert occurrence.issue_title == "Success Issue"
        assert occurrence.culprit == "GET /another/"


class TestGetProjectTopTransactionTracesForLLMDetection(
    APITransactionTestCase, SnubaTestCase, SpanTestCase
):
    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    def test_returns_deduped_transaction_traces(self) -> None:
        trace_id_1 = uuid.uuid4().hex
        span1 = self.create_span(
            {
                "description": "GET /api/users/123456",  # will dedupe
                "sentry_tags": {"transaction": "GET /api/users/123456"},
                "trace_id": trace_id_1,
                "is_segment": True,
                "exclusive_time_ms": 100,
                "duration_ms": 100,
            },
            start_ts=self.ten_mins_ago,
        )

        trace_id_2 = uuid.uuid4().hex
        span2 = self.create_span(
            {
                "description": "GET /api/users/789012",  # will dedupe
                "sentry_tags": {"transaction": "GET /api/users/789012"},
                "trace_id": trace_id_2,
                "is_segment": True,
                "exclusive_time_ms": 200,
                "duration_ms": 200,  # will return before span1 in transaction query
            },
            start_ts=self.ten_mins_ago + timedelta(seconds=1),
        )

        trace_id_3 = uuid.uuid4().hex
        span3 = self.create_span(
            {
                "description": "POST /api/orders",
                "sentry_tags": {"transaction": "POST /api/orders"},
                "trace_id": trace_id_3,
                "is_segment": True,
                "exclusive_time_ms": 150,
                "duration_ms": 150,
            },
            start_ts=self.ten_mins_ago + timedelta(seconds=2),
        )

        self.store_spans([span1, span2, span3], is_eap=True)

        evidence_traces = get_project_top_transaction_traces_for_llm_detection(
            self.project.id, limit=TRANSACTION_BATCH_SIZE, start_time_delta_minutes=30
        )

        assert len(evidence_traces) == 2

        assert (
            evidence_traces[0].trace_id == trace_id_2
        )  # prevails over trace_id_1 because transaction span duration was higher
        assert evidence_traces[0].transaction_name == "GET /api/users/<NUM>"

        assert evidence_traces[1].trace_id == trace_id_3
        assert evidence_traces[1].transaction_name == "POST /api/orders"
