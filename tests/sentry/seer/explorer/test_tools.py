import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from unittest.mock import Mock, patch

import pytest
from pydantic import BaseModel
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.api import client
from sentry.constants import ObjectStatus
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.repository import Repository
from sentry.replays.testutils import mock_replay
from sentry.seer.endpoints.seer_rpc import get_organization_project_ids
from sentry.seer.explorer.tools import (
    EVENT_TIMESERIES_RESOLUTIONS,
    execute_table_query,
    execute_timeseries_query,
    get_issue_and_event_details,
    get_log_attributes_for_trace,
    get_metric_attributes_for_trace,
    get_replay_metadata,
    get_repository_definition,
    get_trace_waterfall,
    rpc_get_profile_flamegraph,
)
from sentry.seer.sentry_data_models import EAPTrace
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
from tests.sentry.issues.test_utils import OccurrenceTestMixin


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
        assert "stats_period" not in params

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
        assert "stats_period" not in params

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
    tags: list[dict[str, str | None]] | None = None


class TestGetIssueAndEventDetails(
    APITransactionTestCase, SnubaTestCase, OccurrenceTestMixin, SpanTestCase
):
    def _validate_event_timeseries(self, timeseries: dict, expected_total: int | None = None):
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

    @patch("sentry.models.group.get_recommended_event")
    @patch("sentry.seer.explorer.tools.get_all_tags_overview")
    def _test_get_ie_details_basic(
        self,
        mock_get_tags,
        mock_get_recommended_event,
        issue_id_type: Literal["int_id", "short_id", "none"],
    ):
        """Test the queries and response format for a group of error events, and multiple event types."""
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}

        # Mock a span for the recommended event's trace.
        event1_trace_id = uuid.uuid4().hex
        span = self.create_span(
            {
                "description": "SELECT * FROM users WHERE id = ?",
                "trace_id": event1_trace_id,
            },
            start_ts=before_now(minutes=5),
            duration=100,
        )
        self.store_spans([span], is_eap=True)

        # Create events with shared stacktrace (should have same group)
        events = []
        for i in range(3):
            data = load_data("python", timestamp=before_now(minutes=5 - i))
            data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
            if i == 1:
                data["contexts"] = data.get("contexts", {})
                data["contexts"]["trace"] = {
                    "trace_id": event1_trace_id,
                    "span_id": span["span_id"],
                }

            event = self.store_event(data=data, project_id=self.project.id)
            events.append(event)

        # Mock the recommended event.
        mock_get_recommended_event.return_value = events[1]

        group = events[0].group
        assert isinstance(group, Group)
        assert events[1].group_id == group.id
        assert events[2].group_id == group.id

        issue_id_param = (
            group.qualified_short_id
            if issue_id_type == "short_id"
            else str(group.id) if issue_id_type == "int_id" else None
        )

        if issue_id_param is None:
            valid_selected_events = [
                uuid.UUID(events[1].event_id).hex,  # no dashes
                str(uuid.UUID(events[1].event_id)),  # with dashes
            ]
            invalid_selected_events = [
                "oldest",
                "latest",
                "recommended",
                events[1].event_id[:8],
                "potato",
            ]

        else:
            valid_selected_events = [
                "oldest",
                "latest",
                "recommended",
                uuid.UUID(events[1].event_id).hex,  # no dashes
                str(uuid.UUID(events[1].event_id)),  # with dashes
            ]
            invalid_selected_events = [
                events[1].event_id[:8],
                "potato",
            ]

        for selected_event in valid_selected_events:
            result = get_issue_and_event_details(
                issue_id=issue_id_param,
                organization_id=self.organization.id,
                selected_event=selected_event,
            )

            assert result is not None
            assert result["project_id"] == self.project.id
            assert result["project_slug"] == self.project.slug
            assert result["tags_overview"] == mock_get_tags.return_value

            # Validate fields of the main issue payload.
            assert isinstance(result["issue"], dict)
            _IssueMetadata.parse_obj(result["issue"])

            # Validate fields of the selected event.
            event_dict = result["event"]
            assert isinstance(event_dict, dict)
            _SentryEventData.parse_obj(event_dict)
            assert result["event_id"] == event_dict["id"]

            # Check correct event is returned based on selected_event_type.
            if selected_event == "oldest":
                assert event_dict["id"] == events[0].event_id, selected_event
            elif selected_event == "latest":
                assert event_dict["id"] == events[-1].event_id, selected_event
            elif selected_event == "recommended":
                assert (
                    event_dict["id"] == mock_get_recommended_event.return_value.event_id
                ), selected_event
            else:
                assert (
                    uuid.UUID(event_dict["id"]).hex == uuid.UUID(selected_event).hex
                ), selected_event

            # Check event_trace_id matches mocked trace context.
            if event_dict["id"] == events[1].event_id:
                assert events[1].trace_id == event1_trace_id
                assert result["event_trace_id"] == event1_trace_id
            else:
                assert result["event_trace_id"] is None

            self._validate_event_timeseries(result["event_timeseries"], expected_total=3)

        for selected_event in invalid_selected_events:
            with pytest.raises(ValueError, match="badly formed hexadecimal UUID string"):
                get_issue_and_event_details(
                    issue_id=issue_id_param,
                    organization_id=self.organization.id,
                    selected_event=selected_event,
                )

    def test_get_ie_details_basic_int_id(self):
        self._test_get_ie_details_basic(issue_id_type="int_id")

    def test_get_ie_details_basic_short_id(self):
        self._test_get_ie_details_basic(issue_id_type="short_id")

    def test_get_ie_details_basic_null_issue_id(self):
        self._test_get_ie_details_basic(issue_id_type="none")

    def test_get_ie_details_nonexistent_organization(self):
        """Test returns None when organization doesn't exist."""
        # Create a valid group.
        data = load_data("python", timestamp=before_now(minutes=5))
        data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
        event = self.store_event(data=data, project_id=self.project.id)
        group = event.group
        assert isinstance(group, Group)

        # Call with nonexistent organization ID.
        result = get_issue_and_event_details(
            issue_id=str(group.id),
            organization_id=99999,
            selected_event="latest",
        )
        assert result is None

    def test_get_ie_details_nonexistent_issue(self):
        """Test returns None when the requested issue doesn't exist."""
        # Call with nonexistent issue ID.
        result = get_issue_and_event_details(
            issue_id="99999",
            organization_id=self.organization.id,
            selected_event="latest",
        )
        assert result is None

    @patch("sentry.models.group.get_oldest_or_latest_event")
    @patch("sentry.models.group.get_recommended_event")
    @patch("sentry.seer.explorer.tools.get_all_tags_overview")
    def test_get_ie_details_no_event_found(
        self, mock_get_tags, mock_get_recommended_event, mock_get_oldest_or_latest_event
    ):
        """Test returns None when issue is found but selected_event is not."""
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}
        mock_get_recommended_event.return_value = None
        mock_get_oldest_or_latest_event.return_value = None

        # Create events with shared stacktrace (should have same group)
        for i in range(2):
            data = load_data("python", timestamp=before_now(minutes=5 - i))
            data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
            event = self.store_event(data=data, project_id=self.project.id)

        group = event.group
        assert isinstance(group, Group)

        for et in ["oldest", "latest", "recommended", uuid.uuid4().hex]:
            result = get_issue_and_event_details(
                issue_id=str(group.id),
                organization_id=self.organization.id,
                selected_event=et,
            )
            assert result is None, et

    def test_get_ie_details_no_event_found_null_issue_id(self):
        """Test returns None when issue_id is not provided and selected_event is not found."""
        _ = self.project  # Create an active project.
        result = get_issue_and_event_details(
            issue_id=None,
            organization_id=self.organization.id,
            selected_event=uuid.uuid4().hex,
        )
        assert result is None

    @patch("sentry.seer.explorer.tools.get_all_tags_overview")
    def test_get_ie_details_tags_exception(self, mock_get_tags):
        mock_get_tags.side_effect = Exception("Test exception")
        """Test other fields are returned with null tags_overview when tag util fails."""
        # Create a valid group.
        data = load_data("python", timestamp=before_now(minutes=5))
        data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
        event = self.store_event(data=data, project_id=self.project.id)
        group = event.group
        assert isinstance(group, Group)

        result = get_issue_and_event_details(
            issue_id=str(group.id),
            organization_id=self.organization.id,
            selected_event="latest",
        )
        assert result is not None
        assert result["tags_overview"] is None

        assert "event_trace_id" in result
        assert isinstance(result.get("project_id"), int)
        assert isinstance(result.get("issue"), dict)
        _IssueMetadata.parse_obj(result.get("issue", {}))

    @patch("sentry.models.group.get_recommended_event")
    @patch("sentry.seer.explorer.tools.get_all_tags_overview")
    def test_get_ie_details_with_assigned_user(
        self,
        mock_get_tags,
        mock_get_recommended_event,
    ):
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}
        data = load_data("python", timestamp=before_now(minutes=5))
        event = self.store_event(data=data, project_id=self.project.id)

        mock_get_recommended_event.return_value = event
        group = event.group
        assert isinstance(group, Group)

        # Create assignee.
        GroupAssignee.objects.create(group=group, project=self.project, user_id=self.user.id)

        result = get_issue_and_event_details(
            issue_id=str(group.id),
            organization_id=self.organization.id,
            selected_event="recommended",
        )

        assert result is not None
        md = _IssueMetadata.parse_obj(result["issue"])
        assert md.assignedTo is not None
        assert md.assignedTo.type == "user"
        assert md.assignedTo.id == str(self.user.id)
        assert md.assignedTo.email == self.user.email
        assert md.assignedTo.name == self.user.get_display_name()

    @patch("sentry.models.group.get_recommended_event")
    @patch("sentry.seer.explorer.tools.get_all_tags_overview")
    def test_get_ie_details_with_assigned_team(self, mock_get_tags, mock_get_recommended_event):
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}
        data = load_data("python", timestamp=before_now(minutes=5))
        event = self.store_event(data=data, project_id=self.project.id)

        mock_get_recommended_event.return_value = event
        group = event.group
        assert isinstance(group, Group)

        # Create assignee.
        GroupAssignee.objects.create(group=group, project=self.project, team=self.team)

        result = get_issue_and_event_details(
            issue_id=str(group.id),
            organization_id=self.organization.id,
            selected_event="recommended",
        )

        assert result is not None
        md = _IssueMetadata.parse_obj(result["issue"])
        assert md.assignedTo is not None
        assert md.assignedTo.type == "team"
        assert md.assignedTo.id == str(self.team.id)
        assert md.assignedTo.name == self.team.slug
        assert md.assignedTo.email is None

    @patch("sentry.seer.explorer.tools.client")
    @patch("sentry.models.group.get_recommended_event")
    @patch("sentry.seer.explorer.tools.get_all_tags_overview")
    def test_get_ie_details_timeseries_resolution(
        self,
        mock_get_tags,
        mock_get_recommended_event,
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
            mock_get_recommended_event.return_value = event

            # Second newer event
            data = load_data("python", timestamp=first_seen + timedelta(minutes=6, seconds=7))
            data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
            self.store_event(data=data, project_id=self.project.id)

            group = event.group
            assert isinstance(group, Group)
            assert group.first_seen == first_seen

            result = get_issue_and_event_details(
                issue_id=str(group.id),
                organization_id=self.organization.id,
                selected_event="recommended",
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
            self._validate_event_timeseries(result["event_timeseries"])
            assert result["timeseries_stats_period"] == stats_period
            assert result["timeseries_interval"] == interval

            # Ensure next iteration makes a fresh group.
            group.delete()

    @patch("sentry.models.group.get_recommended_event")
    @patch("sentry.seer.explorer.tools.get_all_tags_overview")
    def test_get_ie_details_recommended_event_fallback(
        self,
        mock_get_tags,
        mock_get_recommended_event,
    ):
        """Test the recommended event falls back to a random event with spans when it has no related spans."""
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}

        # Mock a span for event1's trace. event1 should always be returned for this test.
        event1_trace_id = uuid.uuid4().hex
        span = self.create_span(
            {
                "description": "SELECT * FROM users WHERE id = ?",
                "trace_id": event1_trace_id,
            },
            start_ts=before_now(minutes=5),
            duration=100,
        )
        self.store_spans([span], is_eap=True)

        # Create events with shared stacktrace (should have same group).
        # Event 0 has a trace but no spans, event 1 has spans, event 2 has no trace.
        events = []
        for i in range(3):
            data = load_data("python", timestamp=before_now(minutes=5 - i))
            data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}
            if i == 0:
                data["contexts"] = data.get("contexts", {})
                data["contexts"]["trace"] = {
                    "trace_id": uuid.uuid4().hex,
                    "span_id": "1" + uuid.uuid4().hex[:15],
                }
            if i == 1:
                data["contexts"] = data.get("contexts", {})
                data["contexts"]["trace"] = {
                    "trace_id": event1_trace_id,
                    "span_id": span["span_id"],
                }

            event = self.store_event(data=data, project_id=self.project.id)
            events.append(event)

        group = events[0].group
        assert isinstance(group, Group)
        assert events[1].group_id == group.id
        assert events[2].group_id == group.id

        for i, rec_event in enumerate([*events, None]):
            mock_get_recommended_event.return_value = rec_event

            result = get_issue_and_event_details(
                issue_id=group.qualified_short_id,
                organization_id=self.organization.id,
                selected_event="recommended",
            )

            # Validate response structure.
            assert result is not None
            assert result["project_id"] == self.project.id
            assert result["project_slug"] == self.project.slug
            assert result["tags_overview"] == mock_get_tags.return_value
            assert isinstance(result["issue"], dict)
            _IssueMetadata.parse_obj(result["issue"])

            event_dict = result["event"]
            assert isinstance(event_dict, dict)
            _SentryEventData.parse_obj(event_dict)
            assert result["event_id"] == event_dict["id"]

            # Validate the only event with spans is returned.
            assert (
                event_dict["id"] == events[1].event_id
            ), f"failed to return an event with spans for recommended event {i if rec_event else 'none'}"


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
