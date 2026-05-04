import uuid
from datetime import timedelta
from unittest.mock import Mock, patch

import pytest
from django.db.models import F

from sentry.issues.grouptype import AIDetectedDBGroupType
from sentry.models.project import Project
from sentry.tasks.llm_issue_detection import (
    DetectedIssue,
    create_issue_occurrence_from_detection,
    detect_llm_issues_for_org,
)
from sentry.tasks.llm_issue_detection.detection import (
    START_TIME_DELTA_MINUTES,
    TRANSACTION_BATCH_SIZE,
)
from sentry.tasks.llm_issue_detection.trace_data import (
    get_project_top_transaction_traces_for_llm_detection,
    get_valid_trace_ids_by_span_count,
)
from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature


class LLMIssueDetectionTest(TestCase):
    def setUp(self):
        super().setUp()
        patcher = patch("sentry.tasks.llm_issue_detection.detection.Project.objects.filter")
        self.mock_project_filter = patcher.start()
        self.mock_project_filter.return_value.values_list.return_value = [self.project.id]
        self.addCleanup(patcher.stop)

    @staticmethod
    def _budget_ok_response() -> Mock:
        response = Mock()
        response.status = 200
        response.data = b'{"has_budget": true}'
        return response

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    @patch("sentry.tasks.llm_issue_detection.detection.make_issue_detection_request")
    @patch(
        "sentry.tasks.llm_issue_detection.trace_data.get_project_top_transaction_traces_for_llm_detection"
    )
    def test_detect_llm_issues_no_transactions(
        self, mock_get_transactions, mock_seer_request, mock_budget_request
    ):
        mock_budget_request.return_value = self._budget_ok_response()

        mock_get_transactions.return_value = []

        detect_llm_issues_for_org(self.organization.id)

        mock_get_transactions.assert_called_once_with(
            self.project.id,
            limit=TRANSACTION_BATCH_SIZE,
            start_time_delta_minutes=START_TIME_DELTA_MINUTES,
        )
        mock_seer_request.assert_not_called()

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    @patch("sentry.tasks.llm_issue_detection.trace_data.Spans.run_table_query")
    @patch("sentry.tasks.llm_issue_detection.detection.make_issue_detection_request")
    def test_detect_llm_issues_no_traces(
        self, mock_seer_request, mock_spans_query, mock_budget_request
    ):
        mock_budget_request.return_value = self._budget_ok_response()

        mock_spans_query.side_effect = [
            # First call: Return a transaction
            {
                "data": [{"transaction": "transaction_name", "sum(span.duration)": 1000}],
                "meta": {},
            },
            # Second call (trace query): return empty
            {"data": [], "meta": {}},
        ]

        detect_llm_issues_for_org(self.organization.id)

        mock_seer_request.assert_not_called()

    @patch("sentry.tasks.llm_issue_detection.detection.produce_occurrence_to_kafka")
    def test_create_issue_occurrence_from_detection(self, mock_produce_occurrence):
        detected_issue = DetectedIssue(
            title="Inefficient Database Queries",
            explanation="Multiple sequential queries could be batched",
            impact="High - may cause request failures",
            evidence="Connection pool at 95% capacity",
            offender_span_ids=["span_1", "span_2"],
            trace_id="abc123xyz",
            transaction_name="test_transaction",
            verification_reason="Problem is correctly identified",
            group_for_fingerprint="Inefficient Database Queries",
        )

        create_issue_occurrence_from_detection(
            detected_issue=detected_issue,
            project=self.project,
        )

        assert mock_produce_occurrence.called
        call_kwargs = mock_produce_occurrence.call_args.kwargs

        assert call_kwargs["payload_type"].value == "occurrence"

        occurrence = call_kwargs["occurrence"]
        assert occurrence.type == AIDetectedDBGroupType
        assert occurrence.issue_title == "Inefficient Database Queries"
        assert occurrence.subtitle == "Multiple sequential queries could be batched"
        assert occurrence.project_id == self.project.id
        assert occurrence.culprit == "test_transaction"
        assert occurrence.level == "warning"

        assert occurrence.fingerprint == [f"1-{AIDetectedDBGroupType.type_id}-test_transaction"]

        assert occurrence.evidence_data["trace_id"] == "abc123xyz"
        assert occurrence.evidence_data["transaction"] == "test_transaction"
        assert (
            occurrence.evidence_data["explanation"]
            == "Multiple sequential queries could be batched"
        )
        assert occurrence.evidence_data["impact"] == "High - may cause request failures"

        evidence_display = occurrence.evidence_display
        assert len(evidence_display) == 3

        assert evidence_display[0].name == "Explanation"
        assert evidence_display[0].value == "Multiple sequential queries could be batched"
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
    def test_create_issue_occurrence_fingerprint_uses_transaction_name(
        self, mock_produce_occurrence
    ):
        detected_issue = DetectedIssue(
            title="Inefficient Database Queries",
            explanation="Multiple queries in loop",
            impact="Medium",
            evidence="5 queries",
            offender_span_ids=[],
            trace_id="trace456",
            transaction_name="GET /api",
            verification_reason="Verified",
            group_for_fingerprint="N+1 Database Queries",
        )
        create_issue_occurrence_from_detection(
            detected_issue=detected_issue,
            project=self.project,
        )
        occurrence = mock_produce_occurrence.call_args.kwargs["occurrence"]
        assert occurrence.fingerprint == [f"1-{AIDetectedDBGroupType.type_id}-get-/api"]
        assert occurrence.type == AIDetectedDBGroupType

    @patch("sentry.tasks.llm_issue_detection.detection.produce_occurrence_to_kafka")
    def test_general_type_skips_occurrence_creation(self, mock_produce_occurrence):
        detected_issue = DetectedIssue(
            title="Other",
            explanation="Something unusual happening here",
            impact="Low",
            evidence="Observed in trace",
            offender_span_ids=[],
            trace_id="trace789",
            transaction_name="POST /foo",
            verification_reason="Verified",
            group_for_fingerprint="Other",
        )
        create_issue_occurrence_from_detection(
            detected_issue=detected_issue,
            project=self.project,
        )
        assert not mock_produce_occurrence.called

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    @patch("sentry.tasks.llm_issue_detection.detection.make_issue_detection_request")
    @patch("sentry.tasks.llm_issue_detection.trace_data.Spans.run_table_query")
    def test_detect_llm_issues_full_flow(
        self,
        mock_spans_query,
        mock_seer_request,
        mock_budget_request,
    ):
        mock_budget_request.return_value = self._budget_ok_response()

        mock_spans_query.side_effect = [
            {
                "data": [
                    {"transaction": "POST /some/thing", "sum(span.duration)": 1007},
                ],
                "meta": {},
            },
            {
                "data": [
                    {"trace": "trace_id_1", "precise.start_ts": 1234},
                ],
                "meta": {},
            },
            {
                "data": [
                    {"trace": "trace_id_1", "count()": 50},
                ],
                "meta": {},
            },
        ]

        mock_accepted_response = Mock()
        mock_accepted_response.status = 202
        mock_seer_request.return_value = mock_accepted_response

        detect_llm_issues_for_org(self.organization.id)

        assert mock_spans_query.call_count == 3
        assert mock_seer_request.call_count == 1

        seer_request = mock_seer_request.call_args[0][0]
        assert seer_request.project_id == self.project.id
        assert seer_request.organization_id == self.organization.id
        assert len(seer_request.traces) == 1

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    @patch("sentry.tasks.llm_issue_detection.detection.make_issue_detection_request")
    @patch("sentry.tasks.llm_issue_detection.trace_data.Spans.run_table_query")
    @patch("sentry.tasks.llm_issue_detection.detection.logger.error")
    def test_detect_llm_issues_seer_error_logged(
        self,
        mock_logger_error,
        mock_spans_query,
        mock_seer_request,
        mock_budget_request,
    ):
        mock_budget_request.return_value = self._budget_ok_response()

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

        detect_llm_issues_for_org(self.organization.id)

        assert mock_seer_request.call_count == 1
        assert mock_logger_error.call_count == 1

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.make_issue_detection_request")
    @patch(
        "sentry.tasks.llm_issue_detection.trace_data.get_project_top_transaction_traces_for_llm_detection"
    )
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    def test_check_budget_fail_open(self, mock_budget_request, mock_get_transactions, _):
        mock_budget_response = Mock()
        mock_budget_response.status = 500
        mock_budget_response.data = b"Internal Server Error"
        mock_budget_request.return_value = mock_budget_response

        mock_get_transactions.return_value = []

        detect_llm_issues_for_org(self.organization.id)

        mock_get_transactions.assert_called_once()

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.make_issue_detection_request")
    @patch(
        "sentry.tasks.llm_issue_detection.trace_data.get_project_top_transaction_traces_for_llm_detection"
    )
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    def test_check_budget_over_budget(
        self, mock_budget_request, mock_get_transactions, mock_seer_request
    ):
        mock_budget_response = Mock()
        mock_budget_response.status = 200
        mock_budget_response.data = b'{"has_budget": false}'
        mock_budget_request.return_value = mock_budget_response

        detect_llm_issues_for_org(self.organization.id)

        mock_get_transactions.assert_not_called()
        mock_seer_request.assert_not_called()

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.make_issue_detection_request")
    @patch(
        "sentry.tasks.llm_issue_detection.trace_data.get_project_top_transaction_traces_for_llm_detection"
    )
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    def test_plan_tier_forwarded_to_seer(
        self, mock_budget_request, mock_get_transactions, mock_seer_request
    ):
        mock_budget_request.return_value = self._budget_ok_response()
        mock_get_transactions.return_value = []

        detect_llm_issues_for_org(self.organization.id, plan_tier="team")

        budget_url = mock_budget_request.call_args[0][1]
        assert "plan_tier=team" in budget_url

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.make_issue_detection_request")
    @patch(
        "sentry.tasks.llm_issue_detection.trace_data.get_project_top_transaction_traces_for_llm_detection"
    )
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    def test_plan_tier_defaults_to_business(
        self, mock_budget_request, mock_get_transactions, mock_seer_request
    ):
        mock_budget_request.return_value = self._budget_ok_response()
        mock_get_transactions.return_value = []

        detect_llm_issues_for_org(self.organization.id)

        budget_url = mock_budget_request.call_args[0][1]
        assert "plan_tier=business" in budget_url


class LLMIssueDetectionProjectFilterTest(TestCase):
    @with_feature("organizations:gen-ai-features")
    @patch("sentry.tasks.llm_issue_detection.detection.make_signed_seer_api_request")
    @patch(
        "sentry.tasks.llm_issue_detection.trace_data.get_project_top_transaction_traces_for_llm_detection"
    )
    def test_skips_projects_without_transactions(self, mock_get_transactions, mock_budget_request):
        project_with_txns = self.create_project(organization=self.organization)
        project_with_txns.update(flags=F("flags").bitor(Project.flags.has_transactions))

        project_without_txns = self.create_project(organization=self.organization)

        mock_budget_response = Mock()
        mock_budget_response.status = 200
        mock_budget_response.data = b'{"has_budget": true}'
        mock_budget_request.return_value = mock_budget_response
        mock_get_transactions.return_value = []

        detect_llm_issues_for_org(self.organization.id)

        mock_get_transactions.assert_called_once()
        called_project_id = mock_get_transactions.call_args[0][0]
        assert called_project_id == project_with_txns.id
        assert called_project_id != project_without_txns.id


class TestGetValidTraceIdsBySpanCount:
    @pytest.mark.parametrize(
        ("query_result", "expected"),
        [
            # All valid
            (
                {"data": [{"trace": "a", "count()": 50}, {"trace": "b", "count()": 100}]},
                {"a": 50, "b": 100},
            ),
            # Some below lower limit
            (
                {"data": [{"trace": "a", "count()": 10}, {"trace": "b", "count()": 50}]},
                {"b": 50},
            ),
            # Some above upper limit
            (
                {"data": [{"trace": "a", "count()": 50}, {"trace": "b", "count()": 600}]},
                {"a": 50},
            ),
            # Empty result
            ({"data": []}, {}),
        ],
    )
    @patch("sentry.tasks.llm_issue_detection.trace_data.Spans.run_table_query")
    def test_filters_by_span_count(
        self, mock_spans_query: Mock, query_result: dict, expected: dict[str, int]
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
    def test_returns_sampled_traces(self, mock_span_count) -> None:
        mock_span_count.side_effect = lambda trace_ids, *args: {tid: 50 for tid in trace_ids}

        trace_id_1 = uuid.uuid4().hex
        span1 = self.create_span(
            {
                "description": "GET /api/users",
                "sentry_tags": {"transaction": "GET /api/users"},
                "trace_id": trace_id_1,
                "is_segment": True,
                "exclusive_time_ms": 200,
                "duration_ms": 200,
            },
            start_ts=self.ten_mins_ago,
        )

        trace_id_2 = uuid.uuid4().hex
        span2 = self.create_span(
            {
                "description": "POST /api/orders",
                "sentry_tags": {"transaction": "POST /api/orders"},
                "trace_id": trace_id_2,
                "is_segment": True,
                "exclusive_time_ms": 150,
                "duration_ms": 150,
            },
            start_ts=self.ten_mins_ago + timedelta(seconds=1),
        )

        self.store_spans([span1, span2])

        evidence_traces = get_project_top_transaction_traces_for_llm_detection(
            self.project.id, limit=TRANSACTION_BATCH_SIZE, start_time_delta_minutes=30
        )

        assert len(evidence_traces) == 2
        result_trace_ids = {t.trace_id for t in evidence_traces}
        assert result_trace_ids == {trace_id_1, trace_id_2}
