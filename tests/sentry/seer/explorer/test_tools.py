import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any, Literal
from unittest.mock import Mock, patch

import pytest
from pydantic import BaseModel
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.api import client
from sentry.constants import ObjectStatus
from sentry.issues.grouptype import PerformanceNPlusOneGroupType, ProfileFileIOGroupType
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.repository import Repository
from sentry.replays.testutils import mock_replay
from sentry.seer.endpoints.seer_rpc import get_organization_project_ids
from sentry.seer.explorer.tools import (
    EVENT_TIMESERIES_RESOLUTIONS,
    _get_recommended_event,
    execute_table_query,
    execute_timeseries_query,
    execute_trace_table_query,
    get_baseline_tag_distribution,
    get_group_tags_overview,
    get_issue_and_event_details_v2,
    get_issue_and_event_response,
    get_log_attributes_for_trace,
    get_metric_attributes_for_trace,
    get_replay_metadata,
    get_repository_definition,
    get_trace_waterfall,
    rpc_get_profile_flamegraph,
)
from sentry.seer.sentry_data_models import EAPTrace
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.tagstore.types import GroupTagKey, GroupTagValue
from sentry.testutils.cases import (
    APITestCase,
    APITransactionTestCase,
    OurLogTestCase,
    ReplaysSnubaTestCase,
    SnubaTestCase,
    SpanTestCase,
    TraceMetricsTestCase,
)
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.dates import parse_stats_period
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin, SearchIssueTestMixin


def _get_utc_iso_without_timezone(dt: datetime) -> str:
    """Seer and Sentry UI pass iso timestamps in this format."""
    return dt.astimezone(UTC).isoformat().replace("+00:00", "")


class TestSpansQuery(APITransactionTestCase, SnubaTestCase, SpanTestCase):
    default_span_fields = [
        "id",
        "span.op",
        "span.description",
        "span.duration",
        "transaction",
        "timestamp",
        "project",
        "trace",
    ]

    def setUp(self):
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)
        self.two_mins_ago = before_now(minutes=2)
        self.one_min_ago = before_now(minutes=1)

        # Create spans using the exact pattern from working tests
        spans = [
            self.create_span(
                {
                    "description": "SELECT * FROM users WHERE id = ?",
                    "sentry_tags": {"op": "db", "transaction": "api/user/profile"},
                },
                start_ts=self.ten_mins_ago,
                duration=150,
            ),
            self.create_span(
                {
                    "description": "SELECT * FROM posts WHERE user_id = ?",
                    "sentry_tags": {"op": "db", "transaction": "api/user/posts"},
                },
                start_ts=self.ten_mins_ago,
                duration=200,
            ),
            self.create_span(
                {
                    "description": "GET https://api.external.com/data",
                    "sentry_tags": {"op": "http.client", "transaction": "api/external/fetch"},
                },
                start_ts=self.ten_mins_ago,
                duration=500,
            ),
            self.create_span(
                {
                    "description": "Redis GET user:123",
                    "sentry_tags": {"op": "cache.get", "transaction": "api/user/profile"},
                },
                start_ts=self.one_min_ago,
                duration=25,
            ),
        ]

        self.store_spans(spans, is_eap=True)

    def test_spans_timeseries_count_metric(self):
        """Test timeseries query with count() metric using real data"""
        result = execute_timeseries_query(
            org_id=self.organization.id,
            dataset="spans",
            query="",
            stats_period="1h",
            y_axes=["count()"],
        )

        assert result is not None
        # Result is now dict from events-stats endpoint
        assert "count()" in result
        assert "data" in result["count()"]

        data_points = result["count()"]["data"]
        assert len(data_points) > 0

        # Each data point is [timestamp, [{"count": value}]]
        total_count = sum(point[1][0]["count"] for point in data_points if point[1])
        assert total_count == 4

    def test_spans_timeseries_count_metric_start_end_filter(self):
        """Test timeseries query with count() metric using real data, filtered by start and end"""
        # Since this is a small range, we need to specify the interval. The event endpoint's
        # get_rollup fx doesn't go below 15m when calculating from date range.
        result = execute_timeseries_query(
            org_id=self.organization.id,
            dataset="spans",
            query="",
            start=_get_utc_iso_without_timezone(self.ten_mins_ago),
            end=_get_utc_iso_without_timezone(self.two_mins_ago),
            interval="1m",
            y_axes=["count()"],
        )

        assert result is not None
        # Result is now dict from events-stats endpoint
        assert "count()" in result
        assert "data" in result["count()"]

        data_points = result["count()"]["data"]
        assert len(data_points) > 0

        # Each data point is [timestamp, [{"count": value}]]
        total_count = sum(point[1][0]["count"] for point in data_points if point[1])
        assert total_count == 3  # Should exclude the span created at 1 minute ago

    @patch("sentry.seer.explorer.tools.client")
    def test_spans_timeseries_count_metric_start_end_prioritized_over_stats_period(
        self, mock_client
    ):
        mock_client.get.side_effect = client.get

        start_iso = _get_utc_iso_without_timezone(self.ten_mins_ago)
        end_iso = _get_utc_iso_without_timezone(self.two_mins_ago)

        execute_timeseries_query(
            org_id=self.organization.id,
            dataset="spans",
            query="",
            stats_period="1h",
            interval="1m",
            start=start_iso,
            end=end_iso,
            y_axes=["count()"],
        )

        params: dict[str, Any] = mock_client.get.call_args.kwargs["params"]
        assert params["start"] is not None
        assert params["start"] == start_iso
        assert params["end"] is not None
        assert params["end"] == end_iso
        assert "statsPeriod" not in params

    def test_spans_timeseries_multiple_metrics(self):
        """Test timeseries query with multiple metrics"""
        result = execute_timeseries_query(
            org_id=self.organization.id,
            dataset="spans",
            query="",
            stats_period="1h",
            y_axes=["count()", "avg(span.duration)"],
        )

        assert result is not None
        # Should have both metrics in result
        assert "count()" in result
        assert "avg(span.duration)" in result

        # Check count metric
        count_data = result["count()"]["data"]
        assert len(count_data) > 0
        total_count = sum(point[1][0]["count"] for point in count_data if point[1])
        assert total_count == 4

        # Check avg duration metric
        avg_duration_data = result["avg(span.duration)"]["data"]
        assert len(avg_duration_data) > 0
        # Should have duration values where count > 0
        duration_values = [
            point[1][0]["count"]
            for point in avg_duration_data
            if point[1] and point[1][0]["count"] > 0
        ]
        assert len(duration_values) > 0

    def test_spans_table_basic_query(self):
        """Test table query returns actual span data"""
        result = execute_table_query(
            org_id=self.organization.id,
            dataset="spans",
            fields=self.default_span_fields,
            query="",
            stats_period="1h",
            sort="-timestamp",
            per_page=10,
        )

        assert result is not None
        assert "data" in result

        rows = result["data"]
        assert len(rows) == 4  # Should find all 4 spans we created

        # Verify span data
        db_rows = [row for row in rows if row.get("span.op") == "db"]
        assert len(db_rows) == 2  # Two database spans

        http_rows = [row for row in rows if row.get("span.op") == "http.client"]
        assert len(http_rows) == 1  # One HTTP span

        cache_rows = [row for row in rows if row.get("span.op") == "cache.get"]
        assert len(cache_rows) == 1  # One cache span

    def test_spans_table_query_start_end_filter(self):
        result = execute_table_query(
            org_id=self.organization.id,
            dataset="spans",
            fields=self.default_span_fields,
            query="",
            start=_get_utc_iso_without_timezone(self.ten_mins_ago),
            end=_get_utc_iso_without_timezone(self.two_mins_ago),
            sort="-timestamp",
            per_page=10,
        )

        assert result is not None
        assert "data" in result

        rows = result["data"]
        assert len(rows) == 3  # Should exclude the span created at 1 minute ago

        # Verify span data
        db_rows = [row for row in rows if row.get("span.op") == "db"]
        assert len(db_rows) == 2  # Two database spans

        http_rows = [row for row in rows if row.get("span.op") == "http.client"]
        assert len(http_rows) == 1  # One HTTP span

    @patch("sentry.seer.explorer.tools.client")
    def test_spans_table_query_start_end_errors_with_stats_period(self, mock_client):
        mock_client.get.side_effect = client.get

        start_iso = _get_utc_iso_without_timezone(self.ten_mins_ago)
        end_iso = _get_utc_iso_without_timezone(self.two_mins_ago)

        execute_table_query(
            org_id=self.organization.id,
            dataset="spans",
            fields=self.default_span_fields,
            query="",
            stats_period="1h",
            start=start_iso,
            end=end_iso,
            sort="-timestamp",
            per_page=10,
        )

        params: dict[str, Any] = mock_client.get.call_args.kwargs["params"]
        assert params["start"] is not None
        assert params["start"] == start_iso
        assert params["end"] is not None
        assert params["end"] == end_iso
        assert "statsPeriod" not in params

    def test_spans_table_specific_operation(self):
        """Test table query filtering by specific operation"""
        result = execute_table_query(
            org_id=self.organization.id,
            dataset="spans",
            fields=self.default_span_fields,
            query="span.op:http.client",
            stats_period="1h",
            sort="-timestamp",
            per_page=10,
        )

        assert result is not None
        rows = result["data"]

        # Should find our http.client span
        http_rows = [row for row in rows if row.get("span.op") == "http.client"]
        assert len(http_rows) == 1

        # Check description contains our external API call
        descriptions = [row.get("span.description", "") for row in http_rows]
        assert any("api.external.com" in desc for desc in descriptions)

    def test_spans_timeseries_empty_results(self):
        """Test timeseries query with query that returns no results"""
        result = execute_timeseries_query(
            org_id=self.organization.id,
            dataset="spans",
            query="span.op:nonexistent",
            stats_period="1h",
            y_axes=["count()"],
        )

        assert result is not None
        assert "count()" in result
        assert "data" in result["count()"]

        # Should have time buckets but with zero counts
        data_points = result["count()"]["data"]
        if data_points:
            total_count = sum(point[1][0]["count"] for point in data_points if point[1])
            assert total_count == 0

    def test_spans_table_empty_results(self):
        """Test table query with query that returns no results"""
        result = execute_table_query(
            org_id=self.organization.id,
            dataset="spans",
            fields=self.default_span_fields,
            query="span.op:nonexistent",
            stats_period="1h",
            sort="-timestamp",
            per_page=10,
        )

        assert result is not None
        assert "data" in result
        assert len(result["data"]) == 0

    def test_spans_timeseries_duration_filtering(self):
        """Test timeseries query with duration filter"""
        result = execute_timeseries_query(
            org_id=self.organization.id,
            dataset="spans",
            query="span.duration:>100ms",  # Should match spans > 100ms
            stats_period="1h",
            y_axes=["count()"],
        )

        assert result is not None
        assert "count()" in result
        assert "data" in result["count()"]

        data_points = result["count()"]["data"]

        # Should find our longer spans (150ms, 200ms, 500ms)
        total_count = sum(point[1][0]["count"] for point in data_points if point[1])
        assert total_count == 3

    def test_spans_table_duration_stats(self):
        """Test table query with duration statistics"""
        result = execute_table_query(
            org_id=self.organization.id,
            dataset="spans",
            fields=self.default_span_fields,
            query="",
            stats_period="1h",
            sort="-span.duration",
            per_page=20,
        )

        assert result is not None
        rows = result["data"]
        assert len(rows) == 4  # All our spans

        # Check that durations are present and reasonable
        durations = [row.get("span.duration") for row in rows if row.get("span.duration")]
        assert len(durations) == 4

        # Should include our test durations (converted from ms to ms in storage)
        expected_durations = [150, 200, 500, 25]
        for expected in expected_durations:
            # Allow for some tolerance in duration matching
            assert any(abs(d - expected) < 10 for d in durations)

    def test_spans_table_appends_sort(self):
        """Test sort is automatically appended to selected fields if not provided."""
        for sort in ["timestamp", "-timestamp"]:
            result = execute_table_query(
                org_id=self.organization.id,
                dataset="spans",
                fields=["id"],
                stats_period="1h",
                sort=sort,
                per_page=1,
            )

            assert result is not None
            rows = result["data"]
            assert "id" in rows[0]
            assert "timestamp" in rows[0]

    def test_spans_query_nonexistent_organization(self):
        """Test queries handle nonexistent organization gracefully"""
        timeseries_result = execute_timeseries_query(
            org_id=99999,
            dataset="spans",
            query="",
            stats_period="1h",
            y_axes=["count()"],
        )
        assert timeseries_result is None

        table_result = execute_table_query(
            org_id=99999,
            dataset="spans",
            fields=self.default_span_fields,
            query="",
            stats_period="1h",
            sort="-count",
            per_page=10,
        )
        assert table_result is None

    @patch("sentry.seer.explorer.tools.client.get")
    def test_spans_table_query_error_handling(self, mock_client_get):
        """Test error handling for API errors: 400 errors return error dict, non-400 errors are re-raised"""
        # Test 400 error with dict body containing detail
        error_detail_msg = "Invalid query: field 'invalid_field' does not exist"
        mock_client_get.side_effect = client.ApiError(400, {"detail": error_detail_msg})

        result = execute_table_query(
            org_id=self.organization.id,
            dataset="spans",
            fields=self.default_span_fields,
            query="invalid_field:value",
            stats_period="1h",
            sort="-timestamp",
            per_page=10,
        )

        assert result is not None
        assert "error" in result
        assert result["error"] == error_detail_msg
        assert "data" not in result

        # Test 400 error with string body
        error_body = "Bad request: malformed query syntax"
        mock_client_get.side_effect = client.ApiError(400, error_body)

        result = execute_table_query(
            org_id=self.organization.id,
            dataset="spans",
            fields=self.default_span_fields,
            query="malformed query",
            stats_period="1h",
            sort="-timestamp",
            per_page=10,
        )

        assert result is not None
        assert "error" in result
        assert result["error"] == error_body
        assert "data" not in result

        # Test non-400 errors are re-raised
        mock_client_get.side_effect = client.ApiError(500, {"detail": "Internal server error"})

        with pytest.raises(client.ApiError) as exc_info:
            execute_table_query(
                org_id=self.organization.id,
                dataset="spans",
                fields=self.default_span_fields,
                query="",
                stats_period="1h",
                sort="-timestamp",
                per_page=10,
            )

        assert exc_info.value.status_code == 500

    def test_spans_timeseries_with_groupby(self):
        """Test timeseries query with group_by parameter for aggregates"""
        result = execute_timeseries_query(
            org_id=self.organization.id,
            dataset="spans",
            query="",
            stats_period="1h",
            y_axes=["count()"],
            group_by=["span.op"],
        )

        assert result is not None
        # Grouped results have group values as top-level keys
        # Should have different span.op values like "db", "http.client", etc.
        assert len(result) > 0

        # Each group should have the metric wrapped in normalized format
        # Format: {"group_value": {"count()": {"data": [...]}}}
        for group_value, metrics in result.items():
            assert isinstance(
                metrics, dict
            ), f"Expected dict for {group_value}, got {type(metrics)}"
            assert (
                "count()" in metrics
            ), f"Missing count() in metrics for {group_value}: {metrics.keys()}"
            assert "data" in metrics["count()"], f"Missing data in count() for {group_value}"

            # Verify we can get actual count data
            data_points = metrics["count()"]["data"]
            assert isinstance(data_points, list)

    def test_spans_table_aggregates_groupby(self):
        """Test table query with group_by for aggregates mode"""
        result = execute_table_query(
            org_id=self.organization.id,
            dataset="spans",
            fields=["span.op", "count()"],
            query="",
            stats_period="1h",
            sort="-count()",
            per_page=10,
        )

        assert result is not None
        assert "data" in result

        rows = result["data"]
        # Should have one row per unique span.op value
        assert len(rows) > 0

        # Each row should have span.op and count()
        for row in rows:
            assert "span.op" in row
            assert "count()" in row

    def test_spans_table_aggregates_basic(self):
        """Test table query in aggregates mode without group_by"""
        result = execute_table_query(
            org_id=self.organization.id,
            dataset="spans",
            query="",
            stats_period="1h",
            sort="-count()",
            fields=["count()", "avg(span.duration)"],
            per_page=10,
        )

        assert result is not None
        assert "data" in result

        rows = result["data"]
        # Should have aggregate results
        assert len(rows) > 0

        # Each row should have the aggregate functions
        for row in rows:
            assert "count()" in row
            assert "avg(span.duration)" in row

    def test_spans_table_aggregates_multiple_functions(self):
        """Test table query in aggregates mode with multiple aggregate functions"""
        result = execute_table_query(
            org_id=self.organization.id,
            dataset="spans",
            query="span.op:db",  # Filter to only database operations
            stats_period="1h",
            sort="-sum(span.duration)",
            fields=["count()", "sum(span.duration)", "avg(span.duration)"],
            per_page=10,
        )

        assert result is not None
        assert "data" in result

        rows = result["data"]
        # Should have aggregate results for database spans
        assert len(rows) > 0

        # Each row should have all the aggregate functions
        for row in rows:
            assert "count()" in row
            assert "sum(span.duration)" in row
            assert "avg(span.duration)" in row

    def test_get_organization_project_ids(self):
        """Test the get_organization_project_ids RPC method"""
        # Test with valid organization
        result = get_organization_project_ids(org_id=self.organization.id)
        assert "projects" in result
        assert isinstance(result["projects"], list)
        assert len(result["projects"]) > 0
        # Check that projects have both id and slug
        project = result["projects"][0]
        assert "id" in project
        assert "slug" in project
        # Check that our project is in the results
        project_ids = [p["id"] for p in result["projects"]]
        assert self.project.id in project_ids

        # Test with nonexistent organization
        result = get_organization_project_ids(org_id=99999)
        assert result == {"projects": []}


class TestGetTraceWaterfall(APITransactionTestCase, SpanTestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    def _test_get_trace_waterfall(self, use_short_id: bool) -> None:
        transaction_name = "api/users/profile"
        trace_id = uuid.uuid4().hex
        spans: list[dict] = []
        for i in range(5):
            # Create a span tree for this trace
            span = self.create_span(
                {
                    **({"description": f"span-{i}"} if i != 4 else {}),
                    "sentry_tags": {"transaction": transaction_name},
                    "trace_id": trace_id,
                    "parent_span_id": (None if i == 0 else spans[i // 2]["span_id"]),
                    "is_segment": i == 0,  # First span is the root
                },
                start_ts=self.ten_mins_ago + timedelta(minutes=i),
            )
            spans.append(span)

        self.store_spans(spans, is_eap=True)
        result = get_trace_waterfall(
            trace_id[:8] if use_short_id else trace_id, self.organization.id
        )
        assert isinstance(result, EAPTrace)
        assert result.trace_id == trace_id
        assert result.org_id == self.organization.id

        seen_span_ids = []
        root_span_ids = []

        def check_span(s):
            if "parent_span_id" not in s:
                # Not a span.
                return

            # Basic assertions and ID collection for returned spans.
            assert "op" in s
            assert "description" in s
            assert "children" in s
            assert s["transaction"] == transaction_name
            assert s["project_id"] == self.project.id

            desc = s["description"]
            assert isinstance(desc, str)
            if desc:
                assert desc.startswith("span-")

            seen_span_ids.append(s["event_id"])

            # Is root
            if s["parent_span_id"] is None:
                assert s["is_transaction"]
                root_span_ids.append(s["event_id"])

            # Recurse
            for child in s["children"]:
                check_span(child)

        for event in result.trace:
            check_span(event)

        assert set(seen_span_ids) == {s["span_id"] for s in spans}
        assert len(root_span_ids) == 1

    def test_get_trace_waterfall_short_id(self) -> None:
        self._test_get_trace_waterfall(use_short_id=True)

    def test_get_trace_waterfall_full_id(self) -> None:
        self._test_get_trace_waterfall(use_short_id=False)

    def test_get_trace_waterfall_wrong_project(self) -> None:
        transaction_name = "api/users/profile"
        trace_id = uuid.uuid4().hex
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        spans: list[dict] = []
        for i in range(2):
            span = self.create_span(
                {
                    "project_id": other_project.id,
                    "description": f"span-{i}",
                    "sentry_tags": {"transaction": transaction_name},
                    "trace_id": trace_id,
                    "parent_span_id": None if i == 0 else spans[0]["span_id"],
                    "is_segment": i == 0,
                },
                start_ts=self.ten_mins_ago + timedelta(minutes=i),
            )
            spans.append(span)

        self.store_spans(spans, is_eap=True)

        # Call with short ID and wrong org
        result = get_trace_waterfall(trace_id[:8], self.organization.id)
        assert result is None

    def test_get_trace_waterfall_sliding_window_second_period(self) -> None:
        """Test that sliding window finds traces in the second 14-day period (14-28 days ago)"""
        transaction_name = "api/users/profile"
        trace_id = uuid.uuid4().hex
        twenty_days_ago = before_now(days=20)

        spans: list[dict] = []
        for i in range(3):
            span = self.create_span(
                {
                    "description": f"span-{i}",
                    "sentry_tags": {"transaction": transaction_name},
                    "trace_id": trace_id,
                    "parent_span_id": None if i == 0 else spans[0]["span_id"],
                    "is_segment": i == 0,
                },
                start_ts=twenty_days_ago + timedelta(minutes=i),
            )
            spans.append(span)

        self.store_spans(spans, is_eap=True)

        # Should find the trace using short ID by sliding back to the second window
        result = get_trace_waterfall(trace_id[:8], self.organization.id)
        assert isinstance(result, EAPTrace)
        assert result.trace_id == trace_id
        assert result.org_id == self.organization.id

    def test_get_trace_waterfall_sliding_window_old_trace(self) -> None:
        """Test that sliding window finds traces near the 90-day limit"""
        transaction_name = "api/users/profile"
        trace_id = uuid.uuid4().hex
        eighty_days_ago = before_now(days=80)

        spans: list[dict] = []
        for i in range(3):
            span = self.create_span(
                {
                    "description": f"span-{i}",
                    "sentry_tags": {"transaction": transaction_name},
                    "trace_id": trace_id,
                    "parent_span_id": None if i == 0 else spans[0]["span_id"],
                    "is_segment": i == 0,
                },
                start_ts=eighty_days_ago + timedelta(minutes=i),
            )
            spans.append(span)

        self.store_spans(spans, is_eap=True)

        # Should find the trace by sliding back through multiple windows
        result = get_trace_waterfall(trace_id[:8], self.organization.id)
        assert isinstance(result, EAPTrace)
        assert result.trace_id == trace_id
        assert result.org_id == self.organization.id

    def test_get_trace_waterfall_sliding_window_beyond_limit(self) -> None:
        """Test that traces beyond 90 days are not found"""
        transaction_name = "api/users/profile"
        trace_id = uuid.uuid4().hex
        one_hundred_days_ago = before_now(days=100)

        spans: list[dict] = []
        for i in range(3):
            span = self.create_span(
                {
                    "description": f"span-{i}",
                    "sentry_tags": {"transaction": transaction_name},
                    "trace_id": trace_id,
                    "parent_span_id": None if i == 0 else spans[0]["span_id"],
                    "is_segment": i == 0,
                },
                start_ts=one_hundred_days_ago + timedelta(minutes=i),
            )
            spans.append(span)

        self.store_spans(spans, is_eap=True)

        # Should not find the trace since it's beyond the 90-day limit
        result = get_trace_waterfall(trace_id[:8], self.organization.id)
        assert result is None

    def test_get_trace_waterfall_includes_status_code(self) -> None:
        """Test that span.status_code is included in additional_attributes."""
        transaction_name = "api/test/status"
        trace_id = uuid.uuid4().hex

        # Create a span with status_code
        span = self.create_span(
            {
                "description": "http-request",
                "sentry_tags": {
                    "transaction": transaction_name,
                    "status_code": "500",
                },
                "trace_id": trace_id,
                "is_segment": True,
            },
            start_ts=self.ten_mins_ago,
        )
        self.store_spans([span], is_eap=True)

        result = get_trace_waterfall(trace_id, self.organization.id)
        assert isinstance(result, EAPTrace)

        # Find the span and verify additional_attributes contains status_code
        root_span = result.trace[0]
        assert "additional_attributes" in root_span
        assert root_span["additional_attributes"].get("span.status_code") == "500"


class TestTraceTableQuery(APITransactionTestCase, SnubaTestCase, SpanTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)
        self.features = {
            "organizations:performance-trace-explorer": True,
            "organizations:visibility-explore-view": True,
        }

    @patch("sentry.seer.explorer.tools.client")
    def test_trace_table_basic(self, mock_client: Mock) -> None:
        """Basic integration test for execute_trace_table_query RPC. This is a passthrough to the OrganizationTracesEndpoint, which is tested more extensively."""
        mock_client.get.side_effect = client.get

        with self.feature(self.features):
            trace_id1 = uuid.uuid4().hex
            trace_id2 = uuid.uuid4().hex
            trace_id3 = uuid.uuid4().hex

            other_project = self.create_project(organization=self.organization)

            spans = [
                self.create_span(
                    {
                        "description": "root span",
                        "sentry_tags": {"transaction": "api/users", "op": "pageload"},
                        "trace_id": trace_id1,
                        "is_segment": True,
                    },
                    start_ts=before_now(minutes=5),
                    duration=120,
                ),
                self.create_span(
                    {
                        "description": "db call",
                        "sentry_tags": {"transaction": "api/users", "op": "db"},
                        "trace_id": trace_id1,
                        "parent_span_id": None,
                    },
                    start_ts=before_now(minutes=4),
                    duration=80,
                ),
                self.create_span(
                    {
                        "description": "unrelated trace",
                        "sentry_tags": {"transaction": "api/other", "op": "pageload"},
                        "trace_id": trace_id2,
                        "is_segment": True,
                    },
                    project=other_project,
                    start_ts=before_now(minutes=3),
                    duration=50,
                ),
                self.create_span(
                    {
                        "description": "db-only trace",
                        "sentry_tags": {"transaction": "api/db", "op": "db"},
                        "trace_id": trace_id3,
                        "is_segment": True,
                    },
                    start_ts=before_now(minutes=2),
                    duration=40,
                ),
            ]

            self.store_spans(spans, is_eap=True)

            # Cross-project query should return both traces with pageload spans.
            result = execute_trace_table_query(
                organization_id=self.organization.id,
                per_page=5,
                query="span.op:pageload",
            )

            assert result is not None
            assert "data" in result
            returned_ids = {row["trace"] for row in result["data"]}
            assert returned_ids == {trace_id1, trace_id2}

            assert (
                mock_client.get.call_args.kwargs["path"]
                == f"/organizations/{self.organization.slug}/traces/"
            )

    @patch("sentry.seer.explorer.tools.client.get")
    def test_trace_table_query_error_handling(self, mock_client_get: Mock) -> None:
        with self.feature(self.features):
            # Test 400 error with dict body containing detail
            error_detail_msg = "Invalid query: field 'invalid_field' does not exist"
            mock_client_get.side_effect = client.ApiError(400, {"detail": error_detail_msg})

            result = execute_trace_table_query(
                organization_id=self.organization.id,
                per_page=5,
                query="invalid_field:value",
                project_ids=[self.project.id],
            )

            assert result is not None
            assert "error" in result
            assert result["error"] == error_detail_msg
            assert "data" not in result

            # Test 400 error with string body
            error_body = "Bad request: malformed query syntax"
            mock_client_get.side_effect = client.ApiError(400, error_body)

            result = execute_trace_table_query(
                organization_id=self.organization.id,
                per_page=5,
                query="malformed query",
                project_ids=[self.project.id],
            )

            assert result is not None
            assert "error" in result
            assert result["error"] == error_body
            assert "data" not in result

            # Test non-400 errors are re-raised
            mock_client_get.side_effect = client.ApiError(500, {"detail": "Internal server error"})

            with pytest.raises(client.ApiError) as exc_info:
                execute_trace_table_query(
                    organization_id=self.organization.id,
                    per_page=5,
                    query="op:db",
                    project_ids=[self.project.id],
                )

            assert exc_info.value.status_code == 500


class _Project(BaseModel):
    id: int
    slug: str


class _Actor(BaseModel):
    """Output of ActorSerializer."""

    type: Literal["user", "team"]
    id: str
    name: str
    email: str | None = None


class _IssueMetadata(BaseModel):
    """
    A subset of BaseGroupSerializerResponse fields useful for Seer Explorer. In prod we send the full response.
    """

    id: int
    shortId: str
    title: str
    culprit: str | None
    permalink: str
    level: str
    status: str
    substatus: str | None
    platform: str | None
    priority: str | None
    type: str
    issueType: str
    issueTypeDescription: str  # Extra field added by get_issue_and_event_details.
    issueCategory: str
    hasSeen: bool
    project: _Project
    assignedTo: _Actor | None = None

    # Optionals
    isUnhandled: bool | None = None
    count: str | None = None
    userCount: int | None = None
    firstSeen: datetime | None = None
    lastSeen: datetime | None = None


class _SentryEventData(BaseModel):
    """
    Required fields for the serialized events used by Seer Explorer.
    """

    title: str
    entries: list[dict]
    groupID: str | None
    tags: list[dict[str, str | None]] | None = None


def _validate_event_timeseries(timeseries: dict, expected_total: int | None = None):
    assert isinstance(timeseries, dict)
    assert "count()" in timeseries
    assert "data" in timeseries["count()"]
    assert isinstance(timeseries["count()"]["data"], list)
    total_count = 0
    for item in timeseries["count()"]["data"]:
        assert len(item) == 2
        assert isinstance(item[0], int)
        assert isinstance(item[1], list)
        assert len(item[1]) == 1
        assert isinstance(item[1][0], dict)
        assert "count" in item[1][0]
        assert isinstance(item[1][0]["count"], int)
        total_count += item[1][0]["count"]
    if expected_total is not None:
        assert (
            total_count == expected_total
        ), f"Expected total count {expected_total}, got {total_count}"


class TestGetGroupTagsOverview(APITestCase, SnubaTestCase):
    @patch("sentry.seer.explorer.tools.get_all_tags_overview")
    @patch("sentry.seer.explorer.tools.client.get")
    def test_tags_overview_builds_group_tag_keys_from_facets(
        self, mock_client_get, mock_get_overview
    ):
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)

        start = _get_utc_iso_without_timezone(datetime.now(UTC) - timedelta(days=1))
        end = _get_utc_iso_without_timezone(datetime.now(UTC))

        facets_response = [
            {
                "key": "browser",
                "topValues": [
                    {"value": "chrome", "name": "Chrome", "count": 3},
                    {"value": "firefox", "name": "Firefox", "count": 1},
                ],
            },
            {
                "key": "environment",
                "topValues": [
                    {"value": "prod", "name": "Production", "count": 2},
                    {"value": "staging", "name": "Staging", "count": 1},
                ],
            },
        ]
        mock_client_get.return_value = SimpleNamespace(data=facets_response)
        mock_get_overview.return_value = {"tags_overview": [{"hello": "world"}]}

        total_events = 51
        result = get_group_tags_overview(group, organization, total_events, start=start, end=end)

        assert result == mock_get_overview.return_value
        mock_client_get.assert_called_once()
        call_kwargs = mock_client_get.call_args.kwargs
        assert call_kwargs["path"] == f"/organizations/{organization.slug}/events-facets/"
        assert call_kwargs["params"]["query"] == f"issue:{group.qualified_short_id}"
        assert call_kwargs["params"]["dataset"] == "errors"
        assert call_kwargs["params"]["project"] == [project.id]
        assert call_kwargs["params"]["start"] == start
        assert call_kwargs["params"]["end"] == end

        tag_keys = mock_get_overview.call_args.kwargs["tag_keys"]
        assert len(tag_keys) == 2

        key_map = {tk.key: tk for tk in tag_keys}

        browser_key = key_map["browser"]
        assert isinstance(browser_key, GroupTagKey)
        assert browser_key.values_seen == 2
        assert browser_key.count == total_events
        assert len(browser_key.top_values) == 2
        assert all(isinstance(tv, GroupTagValue) for tv in browser_key.top_values)
        browser_values = {tv.value: tv.times_seen for tv in browser_key.top_values}
        assert browser_values == {"chrome": 3, "firefox": 1}

        env_key = key_map["environment"]
        assert isinstance(env_key, GroupTagKey)
        assert env_key.values_seen == 2
        assert env_key.count == total_events
        assert len(env_key.top_values) == 2
        env_values = {tv.value: tv.times_seen for tv in env_key.top_values}
        assert env_values == {"prod": 2, "staging": 1}

    @patch("sentry.seer.explorer.tools.get_all_tags_overview")
    @patch("sentry.seer.explorer.tools.client.get")
    def test_tags_overview_no_date_filter_uses_tagstore(self, mock_client_get, mock_get_overview):
        """Falls back to autofix util if no time range is provided (doesn't hit events-facets)."""
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)

        facets_response = [
            {
                "key": "browser",
                "topValues": [
                    {"value": "chrome", "name": "Chrome", "count": 3},
                ],
            },
        ]
        mock_client_get.return_value = SimpleNamespace(data=facets_response)
        mock_get_overview.return_value = {"tags_overview": []}

        get_group_tags_overview(group, organization, 10)

        mock_client_get.assert_not_called()
        mock_get_overview.assert_called_once()
        assert mock_get_overview.call_args.args[0] == group

    @patch("sentry.seer.explorer.tools.get_all_tags_overview")
    @patch("sentry.seer.explorer.tools.client.get")
    def test_tags_overview_issue_platform_dataset(self, mock_client_get, mock_get_overview):
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)
        group.update(type=PerformanceNPlusOneGroupType.type_id)

        facets_response = [
            {
                "key": "browser",
                "topValues": [
                    {"value": "chrome", "name": "Chrome", "count": 3},
                ],
            },
        ]
        mock_client_get.return_value = SimpleNamespace(data=facets_response)
        mock_get_overview.return_value = {"tags_overview": []}

        start = _get_utc_iso_without_timezone(datetime.now(UTC) - timedelta(days=1))
        end = _get_utc_iso_without_timezone(datetime.now(UTC))
        get_group_tags_overview(group, organization, 10, start=start, end=end)

        mock_client_get.assert_called_once()
        call_kwargs = mock_client_get.call_args.kwargs
        assert call_kwargs["path"] == f"/organizations/{organization.slug}/events-facets/"
        assert call_kwargs["params"]["dataset"] == "issuePlatform"
        assert call_kwargs["params"]["query"] == f"issue:{group.qualified_short_id}"
        assert call_kwargs["params"]["project"] == [project.id]

    def test_tags_overview_integration_filters_by_group_and_time(self):
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        self.login_as(self.user)

        now = datetime.now(UTC)
        in_range_1 = now - timedelta(minutes=2)
        in_range_2 = now - timedelta(minutes=1)
        out_of_range = now - timedelta(days=2)

        # Events for the target group within the window
        event1 = self.store_event(
            data={
                "fingerprint": ["group-a"],
                "environment": "production",
                "tags": {"user_role": "admin"},
                "timestamp": in_range_1.isoformat(),
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "fingerprint": ["group-a"],
                "environment": "staging",
                "tags": {"user_role": "admin"},
                "timestamp": in_range_2.isoformat(),
            },
            project_id=project.id,
        )

        # Out-of-range event for same group (should not count)
        self.store_event(
            data={
                "fingerprint": ["group-a"],
                "environment": "production",
                "tags": {"user_role": "user"},
                "timestamp": out_of_range.isoformat(),
            },
            project_id=project.id,
        )

        # Different group event (should not count)
        self.store_event(
            data={
                "fingerprint": ["group-b"],
                "environment": "production",
                "tags": {"user_role": "user"},
                "timestamp": in_range_1.isoformat(),
            },
            project_id=project.id,
        )

        group = event1.group
        assert group is not None

        start = (now - timedelta(minutes=5)).isoformat()
        end = now.isoformat()
        event_count = 4  # Mock "other" tags

        with self.feature({"organizations:discover-basic": True}):
            result = get_group_tags_overview(group, organization, event_count, start=start, end=end)

        assert result is not None
        overview = result["tags_overview"]
        env_tag = next(tag for tag in overview if tag["key"] == "environment")
        role_tag = next(tag for tag in overview if tag["key"] == "user_role")

        assert env_tag["total_values"] == event_count
        env_values = {v["value"]: v["percentage"] for v in env_tag["top_values"]}
        assert env_values == {"production": "25%", "staging": "25%", "other": "50%"}

        assert role_tag["total_values"] == event_count
        role_values = {v["value"]: v["percentage"] for v in role_tag["top_values"]}
        assert role_values == {"admin": "50%", "other": "50%"}

    def test_tags_overview_integration_empty_response(self):
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        self.login_as(self.user)
        group = self.create_group(project=project)

        with self.feature({"organizations:discover-basic": True}):
            result = get_group_tags_overview(group, organization, 0)

        assert result is not None
        assert result["tags_overview"] == []


class TestGetIssueAndEventDetailsV2(
    APITransactionTestCase, SnubaTestCase, OccurrenceTestMixin, SpanTestCase
):
    """Integration tests for the get_issue_and_event_details RPC."""

    @patch("sentry.seer.explorer.tools.get_group_tags_overview")
    def _test_get_ie_details_from_issue_id(
        self,
        mock_get_tags,
        expected_event_idx: int,
        include_issue: bool = True,
        **kwargs,
    ):
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}

        # Mock spans for the first 2 events' traces.
        event0_trace_id = uuid.uuid4().hex
        event1_trace_id = uuid.uuid4().hex
        span0 = self.create_span(
            {
                "description": "SELECT * FROM users WHERE id = ?",
                "trace_id": event0_trace_id,
            },
            start_ts=before_now(days=5, minutes=10),
            duration=100,
        )
        span1 = self.create_span(
            {
                "description": "SELECT * FROM users WHERE id = ?",
                "trace_id": event1_trace_id,
            },
            start_ts=before_now(days=3, hours=23),
            duration=100,
        )
        self.store_spans([span0, span1], is_eap=True)

        # Create events with shared stacktrace (should have same group)
        events: list[Event] = []
        timestamps = [before_now(days=5), before_now(days=4), before_now(hours=3)]
        for i in range(3):
            data = load_data("python", timestamp=timestamps[i])
            data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
            if i == 0:
                data["contexts"] = data.get("contexts", {})
                data["contexts"]["trace"] = {
                    "trace_id": event0_trace_id,
                    "span_id": "1" + uuid.uuid4().hex[:15],
                }
            if i == 1:
                data["contexts"] = data.get("contexts", {})
                data["contexts"]["trace"] = {
                    "trace_id": event1_trace_id,
                    "span_id": "1" + uuid.uuid4().hex[:15],
                }

            event = self.store_event(data=data, project_id=self.project.id)
            events.append(event)

        group = events[0].group
        assert isinstance(group, Group)
        assert events[1].group_id == group.id
        assert events[2].group_id == group.id

        for issue_id_param in [group.qualified_short_id, str(group.id)]:
            result = get_issue_and_event_details_v2(
                organization_id=self.organization.id,
                issue_id=issue_id_param,
                include_issue=include_issue,
                **kwargs,
            )

            assert result is not None
            assert result["project_id"] == self.project.id
            assert result["project_slug"] == self.project.slug

            # Validate issues fields
            if include_issue:
                assert result["tags_overview"] == mock_get_tags.return_value
                _validate_event_timeseries(result["event_timeseries"], expected_total=3)
                assert isinstance(result["issue"], dict)
                _IssueMetadata.parse_obj(result["issue"])
            else:
                assert result.get("issue") is None
                assert result.get("event_timeseries") is None
                assert result.get("tags_overview") is None

            # Check correct event is returned.
            assert result["event_id"] == events[expected_event_idx].event_id
            assert result["event_trace_id"] == events[expected_event_idx].trace_id

            # Validate fields of the selected event.
            event_dict = result["event"]
            assert isinstance(event_dict, dict)
            _SentryEventData.parse_obj(event_dict)
            assert result["event_id"] == event_dict["id"]

    def test_get_ie_details_from_issue_id_basic(
        self,
    ):
        # event1 should be returned since it's more recent.
        self._test_get_ie_details_from_issue_id(
            expected_event_idx=1,
            include_issue=True,
        )

    def test_get_ie_details_from_issue_id_exclude_issue(
        self,
    ):
        self._test_get_ie_details_from_issue_id(
            expected_event_idx=1,
            include_issue=False,
        )

    def test_get_ie_details_from_issue_id_time_range(
        self,
    ):
        # event0 should be returned since the time range excludes event1.
        self._test_get_ie_details_from_issue_id(
            expected_event_idx=0,
            start=before_now(days=7).isoformat(),
            end=before_now(days=4, hours=3).isoformat(),
        )

    def test_get_ie_details_from_issue_id_time_range_fallback(
        self,
    ):
        # event2 should be returned since the time range excludes 0 and 1.
        self._test_get_ie_details_from_issue_id(
            expected_event_idx=2,
            start=before_now(days=1).isoformat(),
            end=before_now(days=0).isoformat(),
        )

    @patch("sentry.seer.explorer.tools.get_group_tags_overview")
    def test_get_ie_details_from_issue_id_no_valid_events(
        self,
        mock_get_tags,
    ):
        """Test an event is still returned when no events have a trace/spans."""
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}

        # Create events with shared stacktrace (should have same group)
        events: list[Event] = []
        for i in range(3):
            data = load_data("python", timestamp=before_now(minutes=5 - i))
            data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
            event = self.store_event(data=data, project_id=self.project.id)
            events.append(event)

        group = events[0].group
        assert isinstance(group, Group)

        for issue_id_param in [group.qualified_short_id, str(group.id)]:
            result = get_issue_and_event_details_v2(
                organization_id=self.organization.id, issue_id=issue_id_param, include_issue=True
            )

            assert result is not None
            assert result["project_id"] == self.project.id
            assert result["project_slug"] == self.project.slug

            # Validate issues fields
            assert result["tags_overview"] == mock_get_tags.return_value
            _validate_event_timeseries(result["event_timeseries"], expected_total=3)
            assert isinstance(result["issue"], dict)
            _IssueMetadata.parse_obj(result["issue"])

            # Check any event is returned with right structure.
            assert "event_id" in result
            assert "event_trace_id" in result

            event_dict = result["event"]
            assert isinstance(event_dict, dict)
            _SentryEventData.parse_obj(event_dict)
            assert result["event_id"] == event_dict["id"]

    @patch("sentry.seer.explorer.tools.get_group_tags_overview")
    def test_get_ie_details_from_issue_id_single_event(
        self,
        mock_get_tags,
    ):
        """Test non-empty result for an issue with a single event."""
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}

        # Mock spans.
        event0_trace_id = uuid.uuid4().hex
        span0 = self.create_span(
            {
                "description": "SELECT * FROM users WHERE id = ?",
                "trace_id": event0_trace_id,
            },
            start_ts=before_now(minutes=10),
            duration=100,
        )
        self.store_spans([span0], is_eap=True)

        # Create one event.
        data = load_data("python", timestamp=before_now(minutes=10))
        data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
        data["contexts"] = data.get("contexts", {})
        data["contexts"]["trace"] = {
            "trace_id": event0_trace_id,
            "span_id": "1" + uuid.uuid4().hex[:15],
        }
        event = self.store_event(data=data, project_id=self.project.id)
        group = event.group
        assert isinstance(group, Group)

        for issue_id_param in [group.qualified_short_id, str(group.id)]:
            result = get_issue_and_event_details_v2(
                organization_id=self.organization.id,
                issue_id=issue_id_param,
                include_issue=True,
            )

            assert result is not None
            assert result["project_id"] == self.project.id
            assert result["project_slug"] == self.project.slug

            # Validate issues fields
            assert result["tags_overview"] == mock_get_tags.return_value
            _validate_event_timeseries(result["event_timeseries"], expected_total=1)
            assert isinstance(result["issue"], dict)
            _IssueMetadata.parse_obj(result["issue"])

            # Check any event is returned with right structure.
            assert "event_id" in result
            assert "event_trace_id" in result

            event_dict = result["event"]
            assert isinstance(event_dict, dict)
            _SentryEventData.parse_obj(event_dict)
            assert result["event_id"] == event_dict["id"]

    @patch("sentry.seer.explorer.tools.get_group_tags_overview")
    def _test_get_ie_details_from_event_id(
        self,
        mock_get_tags,
        include_issue: bool,
    ):
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}

        # Create events with shared stacktrace (should have same group)
        events: list[Event] = []
        for i in range(3):
            data = load_data("python", timestamp=before_now(minutes=5 - i))
            data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
            event = self.store_event(data=data, project_id=self.project.id)
            events.append(event)

        group = events[0].group
        assert isinstance(group, Group)
        assert events[1].group_id == group.id
        assert events[2].group_id == group.id

        # Call the function with events[1].id
        result = get_issue_and_event_details_v2(
            organization_id=self.organization.id,
            event_id=events[1].event_id,
            include_issue=include_issue,
        )

        assert result is not None
        assert result["project_id"] == self.project.id
        assert result["project_slug"] == self.project.slug

        # Validate issues fields
        if include_issue:
            assert result["tags_overview"] == mock_get_tags.return_value
            _validate_event_timeseries(result["event_timeseries"], expected_total=3)
            assert isinstance(result["issue"], dict)
            _IssueMetadata.parse_obj(result["issue"])
        else:
            assert result.get("issue") is None
            assert result.get("event_timeseries") is None
            assert result.get("tags_overview") is None

        # Check correct event is returned.
        assert result["event_id"] == events[1].event_id
        assert result["event_trace_id"] == events[1].trace_id

        # Validate fields of the selected event.
        event_dict = result["event"]
        assert isinstance(event_dict, dict)
        _SentryEventData.parse_obj(event_dict)
        assert result["event_id"] == event_dict["id"]

    def test_get_ie_details_from_event_id_with_issue(self):
        self._test_get_ie_details_from_event_id(
            include_issue=True,
        )

    def test_get_ie_details_from_event_id_without_issue(self):
        self._test_get_ie_details_from_event_id(
            include_issue=False,
        )


class TestGetIssueAndEventResponse(APITransactionTestCase, SnubaTestCase, OccurrenceTestMixin):
    """Unit tests for the util that derives a response from an event and group."""

    @patch("sentry.seer.explorer.tools.get_group_tags_overview")
    def test_get_ie_response_tags_exception(self, mock_get_tags):
        mock_get_tags.side_effect = Exception("Test exception")
        """Test other fields are returned with null tags_overview when tag util fails."""
        # Create a valid group.
        data = load_data("python", timestamp=before_now(minutes=5))
        data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
        event = self.store_event(data=data, project_id=self.project.id)
        group = event.group
        assert isinstance(group, Group)

        result = get_issue_and_event_response(
            event=event,
            group=group,
            organization=self.organization,
        )
        assert result["tags_overview"] is None

        assert "event_trace_id" in result
        assert isinstance(result.get("project_id"), int)
        assert isinstance(result.get("issue"), dict)
        _IssueMetadata.parse_obj(result.get("issue", {}))

    @patch("sentry.seer.explorer.tools.get_group_tags_overview")
    def test_get_ie_response_with_assigned_user(
        self,
        mock_get_tags,
    ):
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}
        data = load_data("python", timestamp=before_now(minutes=5))
        event = self.store_event(data=data, project_id=self.project.id)
        group = event.group
        assert isinstance(group, Group)

        # Create assignee.
        GroupAssignee.objects.create(group=group, project=self.project, user_id=self.user.id)

        result = get_issue_and_event_response(
            event=event,
            group=group,
            organization=self.organization,
        )

        md = _IssueMetadata.parse_obj(result["issue"])
        assert md.assignedTo is not None
        assert md.assignedTo.type == "user"
        assert md.assignedTo.id == str(self.user.id)
        assert md.assignedTo.email == self.user.email
        assert md.assignedTo.name == self.user.get_display_name()

    @patch("sentry.seer.explorer.tools.get_group_tags_overview")
    def test_get_ie_response_with_assigned_team(self, mock_get_tags):
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}
        data = load_data("python", timestamp=before_now(minutes=5))
        event = self.store_event(data=data, project_id=self.project.id)

        group = event.group
        assert isinstance(group, Group)

        # Create assignee.
        GroupAssignee.objects.create(group=group, project=self.project, team=self.team)

        result = get_issue_and_event_response(
            event=event,
            group=group,
            organization=self.organization,
        )

        md = _IssueMetadata.parse_obj(result["issue"])
        assert md.assignedTo is not None
        assert md.assignedTo.type == "team"
        assert md.assignedTo.id == str(self.team.id)
        assert md.assignedTo.name == self.team.slug
        assert md.assignedTo.email is None

    @patch("sentry.seer.explorer.tools.client")
    @patch("sentry.seer.explorer.tools.get_group_tags_overview")
    def test_get_ie_response_timeseries_resolution(
        self,
        mock_get_tags,
        mock_api_client,
    ):
        """Test timeseries resolution for groups with different first_seen dates"""
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}

        for stats_period, interval in EVENT_TIMESERIES_RESOLUTIONS:
            # Fresh mock with passthrough to real client - allows testing call args
            mock_api_client.get = Mock(side_effect=client.get)

            delta = parse_stats_period(stats_period)
            assert delta is not None
            if delta > timedelta(days=30):
                # Skip the 90d test as the retention for testutils is 30d.
                continue

            # Set a first_seen date slightly newer than the stats period we're testing.
            first_seen = datetime.now(UTC) - delta + timedelta(minutes=6, seconds=7)
            data = load_data("python", timestamp=first_seen)
            data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
            event = self.store_event(data=data, project_id=self.project.id)

            # Second newer event
            data = load_data("python", timestamp=first_seen + timedelta(minutes=6, seconds=7))
            data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
            self.store_event(data=data, project_id=self.project.id)

            group = event.group
            assert isinstance(group, Group)
            assert group.first_seen == first_seen

            result = get_issue_and_event_response(
                event=event,
                group=group,
                organization=self.organization,
            )

            # Assert expected stats params were passed to the API.
            stats_request_count = 0
            for _, kwargs in mock_api_client.get.call_args_list:
                if kwargs["path"] == f"/organizations/{self.organization.slug}/events-stats/":
                    stats_request_count += 1
                    assert kwargs["params"]["statsPeriod"] == stats_period
                    assert kwargs["params"]["interval"] == interval

            assert stats_request_count == 1

            # Validate final results.
            assert result is not None
            _validate_event_timeseries(result["event_timeseries"])
            assert result["timeseries_stats_period"] == stats_period
            assert result["timeseries_interval"] == interval

            # Ensure next iteration makes a fresh group.
            group.delete()


class TestGetRecommendedEvent(APITransactionTestCase, SnubaTestCase):
    def test_get_recommended_event_start_clamped_to_retention(self):
        """
        Start is clamped to retention boundary. Spans query should also
        """
        project = self.create_project()

        now = datetime.now(UTC)
        start = now - timedelta(days=11)
        end = now

        retention_days = 5
        retention_boundary = now - timedelta(days=retention_days)

        # Event right after boundary to test spans query clamping to boundary
        data = load_data("python", timestamp=retention_boundary + timedelta(hours=1))
        data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
        data["contexts"] = data.get("contexts", {})
        data["contexts"]["trace"] = {
            "trace_id": uuid.uuid4().hex,
            "span_id": "1" + uuid.uuid4().hex[:15],
        }
        event = self.store_event(
            data=data,
            project_id=project.id,
        )

        with patch(
            "sentry.quotas.backend.get_event_retention",
            return_value=retention_days,
        ):
            with patch(
                "sentry.seer.explorer.tools.execute_table_query"
            ) as mock_execute_table_query:
                mock_execute_table_query.return_value = {"data": []}
                result = _get_recommended_event(
                    group=event.group,
                    organization=project.organization,
                    start=start,
                    end=end,
                )

                assert isinstance(result, GroupEvent)
                assert result.event_id == event.event_id

                # spans query should use retention boundary
                spans_start = datetime.fromisoformat(mock_execute_table_query.call_args[1]["start"])
                assert abs(spans_start - retention_boundary) < timedelta(minutes=1)

    def test_get_recommended_event_end_outside_retention(self):
        """
        No queries are made and returns None if both start and end are outside retention.
        """
        project = self.create_project()
        now = datetime.now(UTC)
        start = now - timedelta(days=11)
        end = now - timedelta(days=9)

        data = load_data("python", timestamp=now - timedelta(days=1))
        data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
        event = self.store_event(
            data=data,
            project_id=project.id,
        )

        with patch("sentry.quotas.backend.get_event_retention", return_value=5):
            result = _get_recommended_event(
                group=event.group,
                organization=project.organization,
                start=start,
                end=end,
            )

        assert result is None


class TestGetRepositoryDefinition(APITransactionTestCase):
    def test_get_repository_definition_success(self):
        """Test successful repository lookup"""
        Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/seer",
            provider="integrations:github",
            external_id="12345678",
            integration_id=123,
            status=ObjectStatus.ACTIVE,
        )

        result = get_repository_definition(
            organization_id=self.organization.id,
            repo_full_name="getsentry/seer",
        )

        assert result is not None
        assert result["organization_id"] == self.organization.id
        assert result["integration_id"] == "123"
        assert result["provider"] == "integrations:github"
        assert result["owner"] == "getsentry"
        assert result["name"] == "seer"
        assert result["external_id"] == "12345678"

    def test_get_repository_definition_invalid_format(self):
        """Test that invalid repo name format returns None"""
        result = get_repository_definition(
            organization_id=self.organization.id,
            repo_full_name="invalid-format",
        )

        assert result is None

    def test_get_repository_definition_not_found(self):
        """Test that nonexistent repository returns None"""
        result = get_repository_definition(
            organization_id=self.organization.id,
            repo_full_name="nonexistent/repo",
        )

        assert result is None

    def test_get_repository_definition_wrong_org(self):
        """Test that repository from different org returns None"""
        other_org = self.create_organization()
        Repository.objects.create(
            organization_id=other_org.id,
            name="getsentry/seer",
            provider="integrations:github",
            external_id="12345678",
            integration_id=123,
            status=ObjectStatus.ACTIVE,
        )

        result = get_repository_definition(
            organization_id=self.organization.id,
            repo_full_name="getsentry/seer",
        )

        assert result is None

    def test_get_repository_definition_inactive_repo(self):
        """Test that inactive repository returns None"""
        Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/seer",
            provider="integrations:github",
            external_id="12345678",
            integration_id=123,
            status=ObjectStatus.DISABLED,
        )

        result = get_repository_definition(
            organization_id=self.organization.id,
            repo_full_name="getsentry/seer",
        )

        assert result is None

    def test_get_repository_definition_no_integration_id(self):
        """Test repository without integration_id"""
        Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/seer",
            provider="integrations:github",
            external_id="12345678",
            integration_id=None,
            status=ObjectStatus.ACTIVE,
        )

        result = get_repository_definition(
            organization_id=self.organization.id,
            repo_full_name="getsentry/seer",
        )

        assert result is not None
        assert result["integration_id"] is None

    def test_get_repository_definition_unsupported_provider(self):
        """Test that repositories with unsupported providers are filtered out"""
        # Create a GitLab repo (unsupported provider)
        Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/seer",
            provider="integrations:gitlab",
            external_id="12345678",
            integration_id=123,
            status=ObjectStatus.ACTIVE,
        )

        result = get_repository_definition(
            organization_id=self.organization.id,
            repo_full_name="getsentry/seer",
        )

        # Should return None since GitLab is not a supported provider
        assert result is None

    def test_get_repository_definition_github_enterprise(self):
        """Test that GitHub Enterprise provider is supported"""
        Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/seer",
            provider="integrations:github_enterprise",
            external_id="12345678",
            integration_id=123,
            status=ObjectStatus.ACTIVE,
        )

        result = get_repository_definition(
            organization_id=self.organization.id,
            repo_full_name="getsentry/seer",
        )

        assert result is not None
        assert result["provider"] == "integrations:github_enterprise"

    def test_get_repository_definition_multiple_providers(self):
        """Test that when multiple repos with different supported providers exist, first one is returned"""
        # Create two repos with same name but different providers
        Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/seer",
            provider="integrations:github",
            external_id="12345678",
            integration_id=123,
            status=ObjectStatus.ACTIVE,
        )
        Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/seer",
            provider="integrations:github_enterprise",
            external_id="87654321",
            integration_id=456,
            status=ObjectStatus.ACTIVE,
        )

        # Should return one of them without raising MultipleObjectsReturned
        result = get_repository_definition(
            organization_id=self.organization.id,
            repo_full_name="getsentry/seer",
        )

        assert result is not None
        # Should return the first matching repo (in this case, GitHub)
        assert result["provider"] in [
            "integrations:github",
            "integrations:github_enterprise",
        ]
        assert result["owner"] == "getsentry"
        assert result["name"] == "seer"

    def test_get_repository_definition_filters_unsupported_with_supported(self):
        """Test that unsupported providers are ignored even when a supported one exists"""
        # Create unsupported provider repo
        Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/seer",
            provider="integrations:gitlab",
            external_id="99999999",
            integration_id=999,
            status=ObjectStatus.ACTIVE,
        )
        # Create supported provider repo
        Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/seer",
            provider="integrations:github",
            external_id="12345678",
            integration_id=123,
            status=ObjectStatus.ACTIVE,
        )

        result = get_repository_definition(
            organization_id=self.organization.id,
            repo_full_name="getsentry/seer",
        )

        # Should return the GitHub repo, not GitLab
        assert result is not None
        assert result["provider"] == "integrations:github"
        assert result["external_id"] == "12345678"

    def test_get_repository_definition_multipart_name(self):
        """Test repository with multi-part name (e.g., owner/project/repo)"""
        Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/project/seer",
            provider="integrations:github",
            external_id="12345678",
            integration_id=123,
            status=ObjectStatus.ACTIVE,
        )

        result = get_repository_definition(
            organization_id=self.organization.id,
            repo_full_name="getsentry/project/seer",
        )

        assert result is not None
        assert result["owner"] == "getsentry"
        assert result["name"] == "project/seer"

    def test_get_repository_definition_by_external_id(self):
        """Test lookup by external_id when repo has been renamed."""
        Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/new-name",  # The NEW name after rename
            provider="integrations:github",
            external_id="12345678",
            integration_id=123,
            status=ObjectStatus.ACTIVE,
        )

        # Seer passes the OLD name but includes external_id
        result = get_repository_definition(
            organization_id=self.organization.id,
            repo_full_name="getsentry/old-name",  # OLD name that won't match
            external_id="12345678",
        )

        assert result is not None
        # Should return the CURRENT name from the database
        assert result["owner"] == "getsentry"
        assert result["name"] == "new-name"


class TestRpcGetProfileFlamegraph(APITestCase, SpanTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    @patch("sentry.seer.explorer.tools._convert_profile_to_execution_tree")
    @patch("sentry.seer.explorer.tools.fetch_profile_data")
    def test_rpc_get_profile_flamegraph_finds_transaction_profile(
        self, mock_fetch_profile, mock_convert_tree
    ):
        """Test finding transaction profile via profile.id with wildcard query"""
        profile_id_8char = "a1b2c3d4"
        full_profile_id = profile_id_8char + "e5f6789012345678901234567"

        # Create span with profile_id (top-level field)
        span = self.create_span(
            {
                "description": "test span",
                "profile_id": full_profile_id,
            },
            start_ts=self.ten_mins_ago,
            duration=100,
        )
        self.store_spans([span], is_eap=True)

        # Mock the profile data fetch and conversion
        mock_fetch_profile.return_value = {"profile": {"frames": [], "stacks": [], "samples": []}}
        mock_convert_tree.return_value = ([{"function": "main", "module": "app"}], "1")

        result = rpc_get_profile_flamegraph(profile_id_8char, self.organization.id)

        # Should find the profile via wildcard query
        assert "execution_tree" in result
        assert result["metadata"]["profile_id"] == full_profile_id
        assert result["metadata"]["is_continuous"] is False

    @patch("sentry.seer.explorer.tools._convert_profile_to_execution_tree")
    @patch("sentry.seer.explorer.tools.fetch_profile_data")
    def test_rpc_get_profile_flamegraph_finds_continuous_profile(
        self, mock_fetch_profile, mock_convert_tree
    ):
        """Test finding continuous profile via profiler.id with wildcard query"""
        profiler_id_8char = "b1c2d3e4"
        full_profiler_id = profiler_id_8char + "f5a6b7c8d9e0f1a2b3c4d5e6"

        # Create span with profiler_id in sentry_tags (continuous profile)
        # Set profile_id to None since continuous profiles use profiler_id instead
        span = self.create_span(
            {
                "description": "continuous span",
                "profile_id": None,
                "sentry_tags": {
                    "profiler_id": full_profiler_id,
                },
            },
            start_ts=self.ten_mins_ago,
            duration=200,
        )
        self.store_spans([span], is_eap=True)

        # Mock the profile data
        mock_fetch_profile.return_value = {
            "chunk": {"profile": {"frames": [], "stacks": [], "samples": []}}
        }
        mock_convert_tree.return_value = ([{"function": "worker", "module": "tasks"}], "2")

        result = rpc_get_profile_flamegraph(profiler_id_8char, self.organization.id)

        # Should find via profiler.id and identify as continuous
        assert "execution_tree" in result
        assert result["metadata"]["profile_id"] == full_profiler_id
        assert result["metadata"]["is_continuous"] is True

    @patch("sentry.seer.explorer.tools._convert_profile_to_execution_tree")
    @patch("sentry.seer.explorer.tools.fetch_profile_data")
    def test_rpc_get_profile_flamegraph_aggregates_timestamps_across_spans(
        self, mock_fetch_profile, mock_convert_tree
    ):
        """Test that min/max timestamps are aggregated across multiple spans with same profile"""
        profile_id_8char = "c1d2e3f4"
        full_profile_id = profile_id_8char + "a5b6c7d8e9f0a1b2c3d4e5f6"

        # Create multiple spans with the same profile at different times
        span1_time = self.ten_mins_ago
        span2_time = self.ten_mins_ago + timedelta(minutes=2)
        span3_time = self.ten_mins_ago + timedelta(minutes=5)

        spans = [
            self.create_span(
                {
                    "description": f"span-{i}",
                    "profile_id": full_profile_id,
                },
                start_ts=start_time,
                duration=100,
            )
            for i, start_time in enumerate([span1_time, span2_time, span3_time])
        ]
        self.store_spans(spans, is_eap=True)

        mock_fetch_profile.return_value = {"profile": {"frames": [], "stacks": [], "samples": []}}
        mock_convert_tree.return_value = ([{"function": "test", "module": "test"}], "3")

        result = rpc_get_profile_flamegraph(profile_id_8char, self.organization.id)

        # Verify the aggregate query worked and got min/max timestamps
        assert "execution_tree" in result
        metadata = result["metadata"]
        assert metadata["profile_id"] == full_profile_id

        # Should have aggregated start_ts and end_ts from all spans
        assert metadata["start_ts"] is not None
        assert metadata["end_ts"] is not None
        # The min should be from span1, max from span3
        assert metadata["start_ts"] <= metadata["end_ts"]

    @patch("sentry.seer.explorer.tools._convert_profile_to_execution_tree")
    @patch("sentry.seer.explorer.tools.fetch_profile_data")
    def test_rpc_get_profile_flamegraph_sliding_window_finds_old_profile(
        self, mock_fetch_profile, mock_convert_tree
    ):
        """Test that sliding 14-day windows can find profiles from 20 days ago"""
        profile_id_8char = "d1e2f3a4"
        full_profile_id = profile_id_8char + "b5c6d7e8f9a0b1c2d3e4f5a6"
        twenty_days_ago = before_now(days=20)

        # Create span 20 days ago
        span = self.create_span(
            {
                "description": "old span",
                "profile_id": full_profile_id,
            },
            start_ts=twenty_days_ago,
            duration=150,
        )
        self.store_spans([span], is_eap=True)

        mock_fetch_profile.return_value = {"profile": {"frames": [], "stacks": [], "samples": []}}
        mock_convert_tree.return_value = ([{"function": "old_function", "module": "old"}], "4")

        result = rpc_get_profile_flamegraph(profile_id_8char, self.organization.id)

        # Should find it via sliding window (second 14-day window)
        assert "execution_tree" in result
        assert result["metadata"]["profile_id"] == full_profile_id

    @patch("sentry.seer.explorer.tools._convert_profile_to_execution_tree")
    @patch("sentry.seer.explorer.tools.fetch_profile_data")
    def test_rpc_get_profile_flamegraph_full_32char_id(self, mock_fetch_profile, mock_convert_tree):
        """Test with full 32-character profile ID (no wildcard needed)"""
        full_profile_id = "e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6"

        span = self.create_span(
            {
                "description": "test span",
                "profile_id": full_profile_id,
            },
            start_ts=self.ten_mins_ago,
            duration=100,
        )
        self.store_spans([span], is_eap=True)

        mock_fetch_profile.return_value = {"profile": {"frames": [], "stacks": [], "samples": []}}
        mock_convert_tree.return_value = ([{"function": "handler", "module": "server"}], "5")

        result = rpc_get_profile_flamegraph(full_profile_id, self.organization.id)

        # Should work with full ID
        assert "execution_tree" in result
        assert result["metadata"]["profile_id"] == full_profile_id

    def test_rpc_get_profile_flamegraph_not_found_in_90_days(self):
        """Test when profile ID doesn't match any spans in 90-day window"""
        # Create a span without the profile we're looking for
        span = self.create_span(
            {
                "description": "unrelated span",
                "profile_id": "different12345678901234567890123",
            },
            start_ts=self.ten_mins_ago,
            duration=100,
        )
        self.store_spans([span], is_eap=True)

        result = rpc_get_profile_flamegraph("notfound", self.organization.id)

        # Should return error indicating not found
        assert "error" in result
        assert "not found in the last 90 days" in result["error"]


class TestGetReplayMetadata(ReplaysSnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    class _ReplayMetadataResponse(BaseModel):
        """Extended from the ReplayDetailsResponse type. Though that type has total=False, we expect all fields to be present for this tool."""

        id: str
        project_id: str
        project_slug: str  # Added for this tool.
        trace_ids: list[str]
        error_ids: list[str]
        environment: str | None
        tags: dict[str, list[str]] | list
        user: dict[str, Any]
        sdk: dict[str, Any]
        os: dict[str, Any]
        browser: dict[str, Any]
        device: dict[str, Any]
        ota_updates: dict[str, Any]
        is_archived: bool | None
        urls: list[str] | None
        clicks: list[dict[str, Any]]
        count_dead_clicks: int | None
        count_rage_clicks: int | None
        count_errors: int | None
        duration: int | None
        finished_at: str | None
        started_at: str | None
        activity: int | None
        count_urls: int | None
        replay_type: str
        count_segments: int | None
        platform: str | None
        releases: list[str]
        dist: str | None
        warning_ids: list[str] | None
        info_ids: list[str] | None
        count_warnings: int | None
        count_infos: int | None
        has_viewed: bool

    def test_get_replay_metadata_full_id(self) -> None:
        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        seq1_timestamp = datetime.now(UTC) - timedelta(seconds=10)
        seq2_timestamp = datetime.now(UTC) - timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay1_id))
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay2_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay2_id))

        with self.feature({"organizations:session-replay": True}):
            # Replay 1
            result = get_replay_metadata(
                replay_id=replay1_id,
                organization_id=self.organization.id,
                project_slug=self.project.slug,
            )
            assert result is not None
            assert result["id"] == replay1_id
            assert result["project_id"] == str(self.project.id)
            assert result["project_slug"] == self.project.slug
            self._ReplayMetadataResponse.parse_obj(result)

            # With dashes
            result = get_replay_metadata(
                replay_id=str(uuid.UUID(replay1_id)),
                organization_id=self.organization.id,
                project_slug=self.project.slug,
            )
            assert result is not None
            assert result["id"] == replay1_id
            assert result["project_id"] == str(self.project.id)
            assert result["project_slug"] == self.project.slug
            self._ReplayMetadataResponse.parse_obj(result)

            # Invalid
            result = get_replay_metadata(
                replay_id=str(uuid.UUID(replay1_id))[:-2] + "gg",
                organization_id=self.organization.id,
                project_slug=self.project.slug,
            )
            assert result is None

            # Replay 2
            result = get_replay_metadata(
                replay_id=replay2_id,
                organization_id=self.organization.id,
                project_slug=self.project.slug,
            )
            assert result is not None
            assert result["id"] == replay2_id
            assert result["project_id"] == str(self.project.id)
            assert result["project_slug"] == self.project.slug
            self._ReplayMetadataResponse.parse_obj(result)

            # No project slug
            result = get_replay_metadata(
                replay_id=replay1_id,
                organization_id=self.organization.id,
            )
            assert result is not None
            assert result["id"] == replay1_id
            assert result["project_id"] == str(self.project.id)
            assert result["project_slug"] == self.project.slug
            self._ReplayMetadataResponse.parse_obj(result)

            # Different project slug
            result = get_replay_metadata(
                replay_id=replay1_id,
                organization_id=self.organization.id,
                project_slug="banana",
            )
            assert result is None

    def test_get_replay_metadata_short_id(self) -> None:
        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex

        self.store_replays(
            mock_replay(datetime.now(UTC) - timedelta(seconds=10), self.project.id, replay1_id)
        )
        self.store_replays(
            mock_replay(datetime.now(UTC) - timedelta(seconds=5), self.project.id, replay1_id)
        )

        # Store a replay at the very start of the retention period.
        self.store_replays(
            mock_replay(
                datetime.now(UTC) - timedelta(days=89, seconds=10), self.project.id, replay2_id
            )
        )
        self.store_replays(
            mock_replay(
                datetime.now(UTC) - timedelta(days=89, seconds=5), self.project.id, replay2_id
            )
        )

        with self.feature({"organizations:session-replay": True}):
            # Replay 1
            result = get_replay_metadata(
                replay_id=replay1_id[:8],
                organization_id=self.organization.id,
            )
            assert result is not None
            assert result["id"] == replay1_id
            assert result["project_id"] == str(self.project.id)
            assert result["project_slug"] == self.project.slug
            self._ReplayMetadataResponse.parse_obj(result)

            # Replay 2
            result = get_replay_metadata(
                replay_id=replay2_id[:8],
                organization_id=self.organization.id,
            )
            assert result is not None
            assert result["id"] == replay2_id
            assert result["project_id"] == str(self.project.id)
            assert result["project_slug"] == self.project.slug
            self._ReplayMetadataResponse.parse_obj(result)

            # Upper (supported but not expected)
            result = get_replay_metadata(
                replay_id=replay1_id[:8].upper(),
                organization_id=self.organization.id,
            )
            assert result is not None
            assert result["id"] == replay1_id
            assert result["project_id"] == str(self.project.id)
            assert result["project_slug"] == self.project.slug
            self._ReplayMetadataResponse.parse_obj(result)

            # Short ID < 8 characters or not hex - returns None
            assert (
                get_replay_metadata(
                    replay_id=replay1_id[:7],
                    organization_id=self.organization.id,
                )
                is None
            )

            assert (
                get_replay_metadata(
                    replay_id=replay1_id[:6] + "gg",
                    organization_id=self.organization.id,
                )
                is None
            )


class TestLogsQuery(APITransactionTestCase, SnubaTestCase, OurLogTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.ten_mins_ago = before_now(minutes=10)
        self.nine_mins_ago = before_now(minutes=9)
        self.default_fields = [
            "id",
            "message",
            "message.template",
            "project.id",
            "trace",
            "severity_number",
            "severity",
            "timestamp",
            "timestamp_precise",
            "observed_timestamp",
        ]

    def test_logs_table_basic(self) -> None:
        # Create logs with various attributes
        logs = [
            self.create_ourlog(
                {
                    "body": "User authentication failed",
                    "severity_text": "ERROR",
                    "severity_number": 17,
                },
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {
                    "body": "Request processed successfully",
                    "severity_text": "INFO",
                    "severity_number": 9,
                },
                timestamp=self.nine_mins_ago,
            ),
            self.create_ourlog(
                {
                    "body": "Database connection timeout",
                    "severity_text": "WARN",
                    "severity_number": 13,
                },
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_ourlogs(logs)

        result = execute_table_query(
            org_id=self.organization.id,
            dataset="logs",
            fields=self.default_fields,
            per_page=10,
            stats_period="1h",
            project_slugs=[self.project.slug],
        )
        assert result is not None
        assert "data" in result
        data = result["data"]
        assert len(data) == len(logs)

        for log in data:
            for field in self.default_fields:
                assert field in log, field


class TestLogsTraceQuery(APITransactionTestCase, SnubaTestCase, OurLogTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.ten_mins_ago = before_now(minutes=10)
        self.nine_mins_ago = before_now(minutes=9)

        self.trace_id = uuid.uuid4().hex
        # Create logs with various attributes
        self.logs = [
            self.create_ourlog(
                {
                    "body": "User authentication failed",
                    "severity_text": "ERROR",
                    "severity_number": 17,
                    "trace_id": self.trace_id,
                },
                attributes={
                    "my-string-attribute": "custom value",
                    "my-boolean-attribute": True,
                    "my-double-attribute": 1.23,
                    "my-integer-attribute": 123,
                },
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {
                    "body": "Request processed successfully",
                    "severity_text": "INFO",
                    "severity_number": 9,
                },
                timestamp=self.nine_mins_ago,
            ),
            self.create_ourlog(
                {
                    "body": "Database connection timeout",
                    "severity_text": "WARN",
                    "severity_number": 13,
                    "trace_id": self.trace_id,
                },
                timestamp=self.nine_mins_ago,
            ),
            self.create_ourlog(
                {
                    "body": "Another database connection timeout",
                    "severity_text": "WARN",
                    "severity_number": 13,
                    "trace_id": self.trace_id,
                },
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_ourlogs(self.logs)

    @staticmethod
    def get_id_str(item: TraceItem) -> str:
        return item.item_id[::-1].hex()

    def test_get_log_attributes_for_trace_basic(self) -> None:
        result = get_log_attributes_for_trace(
            org_id=self.organization.id,
            trace_id=self.trace_id,
            stats_period="1d",
        )
        assert result is not None
        assert len(result["data"]) == 3

        auth_log_expected = self.logs[0]
        auth_log = None
        for item in result["data"]:
            if item["id"] == self.get_id_str(auth_log_expected):
                auth_log = item

        assert auth_log is not None
        ts = datetime.fromisoformat(auth_log["timestamp"]).timestamp()
        assert int(ts) == auth_log_expected.timestamp.seconds

        for name, value in [
            ("message", "User authentication failed"),
            ("project", self.project.slug),
            ("project.id", self.project.id),
            ("severity", "ERROR"),
            ("my-string-attribute", "custom value"),
            ("my-boolean-attribute", True),
            ("my-double-attribute", 1.23),
            ("my-integer-attribute", 123),
        ]:
            assert auth_log["attributes"][name]["value"] == value, name

    def test_get_log_attributes_for_trace_substring_filter(self) -> None:
        result = get_log_attributes_for_trace(
            org_id=self.organization.id,
            trace_id=self.trace_id,
            stats_period="1d",
            message_substring="database",
            substring_case_sensitive=False,
        )
        assert result is not None
        assert len(result["data"]) == 2
        ids = [item["id"] for item in result["data"]]
        assert self.get_id_str(self.logs[2]) in ids
        assert self.get_id_str(self.logs[3]) in ids

        result = get_log_attributes_for_trace(
            org_id=self.organization.id,
            trace_id=self.trace_id,
            stats_period="1d",
            message_substring="database",
            substring_case_sensitive=True,
        )
        assert result is not None
        assert len(result["data"]) == 1
        assert result["data"][0]["id"] == self.get_id_str(self.logs[3])

    def test_get_log_attributes_for_trace_limit_no_filter(self) -> None:
        result = get_log_attributes_for_trace(
            org_id=self.organization.id,
            trace_id=self.trace_id,
            stats_period="1d",
            limit=1,
        )
        assert result is not None
        assert len(result["data"]) == 1
        assert result["data"][0]["id"] in [
            self.get_id_str(self.logs[0]),
            self.get_id_str(self.logs[2]),
            self.get_id_str(self.logs[3]),
        ]

    def test_get_log_attributes_for_trace_limit_with_filter(self) -> None:
        result = get_log_attributes_for_trace(
            org_id=self.organization.id,
            trace_id=self.trace_id,
            stats_period="1d",
            message_substring="database",
            substring_case_sensitive=False,
            limit=2,
        )
        assert result is not None
        assert len(result["data"]) == 2
        ids = [item["id"] for item in result["data"]]
        assert self.get_id_str(self.logs[2]) in ids
        assert self.get_id_str(self.logs[3]) in ids


class TestMetricsTraceQuery(APITransactionTestCase, SnubaTestCase, TraceMetricsTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.ten_mins_ago = before_now(minutes=10)
        self.nine_mins_ago = before_now(minutes=9)

        self.trace_id = uuid.uuid4().hex
        # Create metrics with various attributes
        self.metrics = [
            self.create_trace_metric(
                metric_name="http.request.duration",
                metric_value=125.5,
                metric_type="distribution",
                metric_unit="millisecond",
                trace_id=self.trace_id,
                attributes={
                    "http.method": "GET",
                    "http.status_code": 200,
                    "my-string-attribute": "custom value",
                    "my-boolean-attribute": True,
                    "my-double-attribute": 1.23,
                    "my-integer-attribute": 123,
                },
                timestamp=self.ten_mins_ago,
            ),
            self.create_trace_metric(
                metric_name="database.query.count",
                metric_value=5.0,
                metric_type="counter",
                # No trace_id - should not be returned in trace queries
                timestamp=self.nine_mins_ago,
            ),
            self.create_trace_metric(
                metric_name="http.request.duration",
                metric_value=200.3,
                metric_type="distribution",
                metric_unit="millisecond",
                trace_id=self.trace_id,
                attributes={
                    "http.method": "POST",
                    "http.status_code": 201,
                },
                timestamp=self.nine_mins_ago,
            ),
            self.create_trace_metric(
                metric_name="cache.hit.rate",
                metric_value=0.85,
                metric_type="gauge",
                trace_id=self.trace_id,
                attributes={
                    "cache.type": "redis",
                },
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_trace_metrics(self.metrics)

    @staticmethod
    def get_id_str(item: TraceItem) -> str:
        return item.item_id[::-1].hex()

    def test_get_metric_attributes_for_trace_basic(self) -> None:
        result = get_metric_attributes_for_trace(
            org_id=self.organization.id,
            trace_id=self.trace_id,
            stats_period="1d",
        )
        assert result is not None
        assert len(result["data"]) == 3

        # Find the first http.request.duration metric
        http_metric_expected = self.metrics[0]
        http_metric = None
        for item in result["data"]:
            if item["id"] == self.get_id_str(http_metric_expected):
                http_metric = item

        assert http_metric is not None
        ts = datetime.fromisoformat(http_metric["timestamp"]).timestamp()
        assert int(ts) == http_metric_expected.timestamp.seconds

        for name, value in [
            ("metric.name", "http.request.duration"),
            ("metric.type", "distribution"),
            ("value", 125.5),
            ("project", self.project.slug),
            ("project.id", self.project.id),
            ("http.method", "GET"),
            ("http.status_code", 200),
            ("my-string-attribute", "custom value"),
            ("my-boolean-attribute", True),
            ("my-double-attribute", 1.23),
            ("my-integer-attribute", 123),
        ]:
            assert http_metric["attributes"][name]["value"] == value, name

    def test_get_metric_attributes_for_trace_name_filter(self) -> None:
        # Test substring match (fails)
        result = get_metric_attributes_for_trace(
            org_id=self.organization.id,
            trace_id=self.trace_id,
            stats_period="1d",
            metric_name="http.",
        )
        assert result is not None
        assert len(result["data"]) == 0

        # Test an exact match (case-insensitive)
        result = get_metric_attributes_for_trace(
            org_id=self.organization.id,
            trace_id=self.trace_id,
            stats_period="1d",
            metric_name="Cache.hit.rate",
        )
        assert result is not None
        assert len(result["data"]) == 1
        assert result["data"][0]["id"] == self.get_id_str(self.metrics[3])

    def test_get_metric_attributes_for_trace_limit_no_filter(self) -> None:
        result = get_metric_attributes_for_trace(
            org_id=self.organization.id,
            trace_id=self.trace_id,
            stats_period="1d",
            limit=1,
        )
        assert result is not None
        assert len(result["data"]) == 1
        assert result["data"][0]["id"] in [
            self.get_id_str(self.metrics[0]),
            self.get_id_str(self.metrics[2]),
            self.get_id_str(self.metrics[3]),
        ]

    def test_get_metric_attributes_for_trace_limit_with_filter(self) -> None:
        result = get_metric_attributes_for_trace(
            org_id=self.organization.id,
            trace_id=self.trace_id,
            stats_period="1d",
            metric_name="http.request.duration",
            limit=2,
        )
        assert result is not None
        assert len(result["data"]) == 2
        ids = [item["id"] for item in result["data"]]
        assert self.get_id_str(self.metrics[0]) in ids
        assert self.get_id_str(self.metrics[2]) in ids


class TestGetBaselineTagDistribution(APITransactionTestCase, SnubaTestCase, SearchIssueTestMixin):
    """Tests for get_baseline_tag_distribution RPC handler."""

    def _insert_event(
        self, ts: datetime, group_id: int, tags: dict[str, Any], project_id: int | None = None
    ) -> None:
        """Insert an event with tags into Snuba for testing."""
        import time

        self.snuba_insert(
            (
                2,
                "insert",
                {
                    "event_id": uuid.uuid4().hex,
                    "primary_hash": "a" * 32,
                    "group_id": group_id,
                    "project_id": project_id or self.project.id,
                    "message": "test message",
                    "platform": "python",
                    "datetime": ts.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "data": {
                        "received": time.mktime(ts.timetuple()),
                        "tags": list(tags.items()),
                    },
                },
                {},
            )
        )

    def test_returns_empty_for_empty_tag_keys(self) -> None:
        result = get_baseline_tag_distribution(
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=1,
            tag_keys=[],
        )
        assert result is not None
        assert result["baseline_tag_distribution"] == []

    def test_returns_baseline_excluding_target_group(self) -> None:
        """Test that baseline excludes events from the target group_id."""
        now = datetime.now(UTC)
        before = now - timedelta(hours=1)
        after = now + timedelta(hours=1)

        target_group_id = 12345
        other_group_id = 67890

        # Events in target group (should be EXCLUDED from baseline)
        self._insert_event(now, target_group_id, {"browser": "Chrome", "os": "Windows"})
        self._insert_event(now, target_group_id, {"browser": "Chrome", "os": "Mac"})

        # Events in other groups (should be INCLUDED in baseline)
        self._insert_event(now, other_group_id, {"browser": "Firefox", "os": "Linux"})
        self._insert_event(now, other_group_id, {"browser": "Firefox", "os": "Linux"})
        self._insert_event(now, other_group_id, {"browser": "Chrome", "os": "Windows"})

        result = get_baseline_tag_distribution(
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=target_group_id,
            tag_keys=["browser", "os"],
            start=_get_utc_iso_without_timezone(before),
            end=_get_utc_iso_without_timezone(after),
        )

        assert result is not None
        distribution = result["baseline_tag_distribution"]

        # Build a dict for easier assertions
        dist_dict: dict[tuple[str, str], int] = {}
        for item in distribution:
            key = (item["tag_key"], item["tag_value"])
            dist_dict[key] = item["count"]

        # Only events from other_group_id should be counted
        # Firefox appears 2 times in other group
        assert dist_dict.get(("browser", "Firefox")) == 2
        # Chrome appears 1 time in other group (2 times in target group, excluded)
        assert dist_dict.get(("browser", "Chrome")) == 1
        # Linux appears 2 times in other group
        assert dist_dict.get(("os", "Linux")) == 2
        # Windows appears 1 time in other group (1 time in target group, excluded)
        assert dist_dict.get(("os", "Windows")) == 1

    def test_filters_by_tag_keys(self) -> None:
        """Test that only requested tag keys are returned."""
        now = datetime.now(UTC)
        before = now - timedelta(hours=1)
        after = now + timedelta(hours=1)

        # Insert events with multiple tags
        self._insert_event(now, 1, {"browser": "Chrome", "os": "Windows", "device": "Desktop"})
        self._insert_event(now, 1, {"browser": "Firefox", "os": "Mac", "device": "Mobile"})

        # Only request browser tag
        result = get_baseline_tag_distribution(
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=99999,  # Non-existent group, so all events are baseline
            tag_keys=["browser"],
            start=_get_utc_iso_without_timezone(before),
            end=_get_utc_iso_without_timezone(after),
        )

        assert result is not None
        distribution = result["baseline_tag_distribution"]

        # Only browser tags should be returned
        tag_keys = {item["tag_key"] for item in distribution}
        assert tag_keys == {"browser"}
        assert len(distribution) == 2  # Chrome and Firefox

    def test_combines_events_and_search_issues(self) -> None:
        """Test that baseline includes both error events and issue platform occurrences.

        Note: The store_search_issue test helper creates entries in BOTH the events dataset
        (via store_event) AND the search_issues dataset (via save_issue_occurrence). This is
        a test artifact - in production, performance issues only exist in search_issues.
        As a result, tags from store_search_issue appear twice in the combined count.
        """
        now = datetime.now(UTC)
        before = now - timedelta(hours=1)
        after = now + timedelta(hours=1)

        target_group_id = 12345

        # Insert error events (goes to "events" dataset only)
        self._insert_event(now, 67890, {"browser": "Chrome", "os": "Windows"})
        self._insert_event(now, 67890, {"browser": "Firefox", "os": "Linux"})

        # Insert search issues / performance issues
        # Note: store_search_issue inserts to BOTH events AND search_issues datasets
        fingerprint = f"{ProfileFileIOGroupType.type_id}-test-group"
        self.store_search_issue(
            project_id=self.project.id,
            user_id=1,
            fingerprints=[fingerprint],
            environment=None,
            insert_time=now,
            tags=[("browser", "Safari"), ("os", "Mac")],
        )
        self.store_search_issue(
            project_id=self.project.id,
            user_id=2,
            fingerprints=[fingerprint],
            environment=None,
            insert_time=now,
            tags=[("browser", "Safari"), ("os", "Mac")],
        )

        result = get_baseline_tag_distribution(
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=target_group_id,
            tag_keys=["browser", "os"],
            start=_get_utc_iso_without_timezone(before),
            end=_get_utc_iso_without_timezone(after),
        )

        assert result is not None
        distribution = result["baseline_tag_distribution"]

        # Build a dict for easier assertions
        dist_dict: dict[tuple[str, str], int] = {}
        for item in distribution:
            key = (item["tag_key"], item["tag_value"])
            dist_dict[key] = item["count"]

        # Error events (from _insert_event): Chrome=1, Firefox=1, Windows=1, Linux=1
        # These only go to the events dataset
        assert dist_dict.get(("browser", "Chrome")) == 1
        assert dist_dict.get(("browser", "Firefox")) == 1
        assert dist_dict.get(("os", "Windows")) == 1
        assert dist_dict.get(("os", "Linux")) == 1

        # Search issues (from store_search_issue): Safari and Mac tags
        # Due to test helper behavior, these appear in both datasets (2 occurrences x 2 datasets = 4)
        # This verifies that we ARE querying both datasets and combining results
        assert dist_dict.get(("browser", "Safari")) == 4
        assert dist_dict.get(("os", "Mac")) == 4
