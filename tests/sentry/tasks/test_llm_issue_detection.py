import uuid
from datetime import timedelta
from unittest.mock import Mock, patch

import pytest

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
    _get_unprocessed_traces,
    mark_traces_as_processed,
)
from sentry.tasks.llm_issue_detection.trace_data import (
    get_project_top_transaction_traces_for_llm_detection,
    get_valid_trace_ids_by_span_count,
)
from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.utils import json


class LLMIssueDetectionTest(TestCase):
    @patch("sentry.tasks.llm_issue_detection.detection.detect_llm_issues_for_project.apply_async")
    def test_run_detection_dispatches_sub_tasks(self, mock_apply_async):
        project = self.create_project()

        with self.options(
            {
                "issue-detection.llm-detection.enabled": True,
                "issue-detection.llm-detection.projects-allowlist": [project.id],
            }
        ):
            run_llm_issue_detection()

        mock_apply_async.assert_called_once_with(
            args=[project.id], countdown=0, headers={"sentry-propagate-traces": False}
        )

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    @patch(
        "sentry.tasks.llm_issue_detection.detection.get_project_top_transaction_traces_for_llm_detection"
    )
    def test_detect_llm_issues_no_transactions(self, mock_get_transactions, mock_seer_request):
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
            project=self.project,
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
    @patch("sentry.tasks.llm_issue_detection.detection.mark_traces_as_processed")
    @patch("sentry.tasks.llm_issue_detection.detection._get_unprocessed_traces")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    @patch("sentry.tasks.llm_issue_detection.trace_data.Spans.run_table_query")
    @patch("sentry.tasks.llm_issue_detection.detection.random.shuffle")
    def test_detect_llm_issues_full_flow(
        self,
        mock_shuffle,
        mock_spans_query,
        mock_seer_request,
        mock_get_unprocessed,
        mock_mark_processed,
    ):
        mock_shuffle.return_value = None  # shuffles in-place, mock to prevent reordering
        mock_get_unprocessed.return_value = {"trace_id_1", "trace_id_2"}  # All unprocessed

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
            # Fourth call: span count query
            {
                "data": [
                    {"trace": "trace_id_1", "count()": 50},
                    {"trace": "trace_id_2", "count()": 100},
                ],
                "meta": {},
            },
        ]

        # Seer returns 202 for async processing
        mock_accepted_response = Mock()
        mock_accepted_response.status = 202
        mock_seer_request.return_value = mock_accepted_response

        detect_llm_issues_for_project(self.project.id)

        assert mock_spans_query.call_count == 4  # 1 transactions, 2 traces, 1 span count
        assert mock_seer_request.call_count == 1  # Single batch request

        seer_call = mock_seer_request.call_args.kwargs
        assert seer_call["path"] == "/v1/automation/issue-detection/analyze"
        request_body = json.loads(seer_call["body"].decode("utf-8"))
        assert request_body["project_id"] == self.project.id
        assert request_body["organization_id"] == self.project.organization_id
        assert len(request_body["traces"]) == 2
        trace_ids = {t["trace_id"] for t in request_body["traces"]}
        assert trace_ids == {"trace_id_1", "trace_id_2"}

        assert mock_mark_processed.call_count == 1
        mock_mark_processed.assert_called_once_with(["trace_id_1", "trace_id_2"])

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.mark_traces_as_processed")
    @patch("sentry.tasks.llm_issue_detection.detection._get_unprocessed_traces")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    @patch("sentry.tasks.llm_issue_detection.trace_data.Spans.run_table_query")
    @patch("sentry.tasks.llm_issue_detection.detection.random.shuffle")
    @patch("sentry.tasks.llm_issue_detection.detection.logger.error")
    def test_detect_llm_issues_seer_error_no_traces_marked(
        self,
        mock_logger_error,
        mock_shuffle,
        mock_spans_query,
        mock_seer_request,
        mock_get_unprocessed,
        mock_mark_processed,
    ):
        mock_shuffle.return_value = None
        mock_get_unprocessed.return_value = {"trace_id_1"}

        mock_spans_query.side_effect = [
            {
                "data": [
                    {"transaction": "POST /some/thing", "sum(span.duration)": 1007},
                ],
                "meta": {},
            },
            {"data": [{"trace": "trace_id_1", "precise.start_ts": 1234}], "meta": {}},
            {"data": [{"trace": "trace_id_1", "count()": 50}], "meta": {}},
        ]

        mock_error_response = Mock()
        mock_error_response.status = 500
        mock_error_response.data = b"Internal Server Error"
        mock_seer_request.return_value = mock_error_response

        detect_llm_issues_for_project(self.project.id)

        assert mock_seer_request.call_count == 1
        assert mock_logger_error.call_count == 1
        # Traces NOT marked as processed on error - will be retried next run
        assert mock_mark_processed.call_count == 0


class TestTraceProcessingFunctions:
    @pytest.mark.parametrize(
        ("trace_ids", "mget_return", "expected"),
        [
            # All unprocessed (mget returns None for missing keys)
            (["a", "b", "c"], [None, None, None], {"a", "b", "c"}),
            # Some processed (mget returns "1" for existing keys)
            (["a", "b", "c"], ["1", None, "1"], {"b"}),
            # All processed
            (["a", "b"], ["1", "1"], set()),
            # Empty input
            ([], [], set()),
        ],
    )
    @patch("sentry.tasks.llm_issue_detection.detection.redis_clusters")
    def test_get_unprocessed_traces(
        self, mock_redis_clusters: Mock, trace_ids: list, mget_return: list, expected: set
    ) -> None:
        mock_cluster = Mock()
        mock_redis_clusters.get.return_value = mock_cluster
        mock_cluster.mget.return_value = mget_return

        result = _get_unprocessed_traces(trace_ids)

        assert result == expected

    @pytest.mark.parametrize(
        ("trace_ids", "expected_set_calls"),
        [
            (["trace_123"], 1),  # Single trace
            (["trace_1", "trace_2", "trace_3"], 3),  # Multiple traces
            ([], 0),  # Empty list - early return, no pipeline calls
        ],
    )
    @patch("sentry.tasks.llm_issue_detection.detection.redis_clusters")
    def test_mark_traces_as_processed(
        self, mock_redis_clusters: Mock, trace_ids: list[str], expected_set_calls: int
    ) -> None:
        mock_cluster = Mock()
        mock_pipeline = Mock()
        mock_redis_clusters.get.return_value = mock_cluster
        mock_cluster.pipeline.return_value.__enter__ = Mock(return_value=mock_pipeline)
        mock_cluster.pipeline.return_value.__exit__ = Mock(return_value=False)

        mark_traces_as_processed(trace_ids)

        assert mock_pipeline.set.call_count == expected_set_calls
        if expected_set_calls == 0:
            mock_cluster.pipeline.assert_not_called()
        else:
            mock_pipeline.execute.assert_called_once()


class TestGetValidTraceIdsBySpanCount:
    @pytest.mark.parametrize(
        ("query_result", "expected"),
        [
            # All valid
            (
                {"data": [{"trace": "a", "count()": 50}, {"trace": "b", "count()": 100}]},
                {"a", "b"},
            ),
            # Some below lower limit
            (
                {"data": [{"trace": "a", "count()": 10}, {"trace": "b", "count()": 50}]},
                {"b"},
            ),
            # Some above upper limit
            (
                {"data": [{"trace": "a", "count()": 50}, {"trace": "b", "count()": 600}]},
                {"a"},
            ),
            # Empty result
            ({"data": []}, set()),
        ],
    )
    @patch("sentry.tasks.llm_issue_detection.trace_data.Spans.run_table_query")
    def test_filters_by_span_count(
        self, mock_spans_query: Mock, query_result: dict, expected: set
    ) -> None:
        mock_spans_query.return_value = query_result
        mock_snuba_params = Mock()
        mock_config = Mock()

        result = get_valid_trace_ids_by_span_count(
            ["a", "b", "c", "d"], mock_snuba_params, mock_config
        )

        assert result == expected


class TestGetProjectTopTransactionTracesForLLMDetection(
    APITransactionTestCase, SnubaTestCase, SpanTestCase
):
    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    @patch("sentry.tasks.llm_issue_detection.trace_data.get_valid_trace_ids_by_span_count")
    def test_returns_deduped_transaction_traces(self, mock_span_count) -> None:
        # Mock span count check to return all traces as valid
        mock_span_count.side_effect = lambda trace_ids, *args: set(trace_ids)

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

        self.store_spans([span1, span2, span3])

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
