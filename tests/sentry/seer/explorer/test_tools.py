import pytest

from sentry.seer.explorer.tools import execute_trace_query_chart, execute_trace_query_table
from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


@pytest.mark.django_db(databases=["default", "control"])
class TestExplorerTools(APITransactionTestCase, SnubaTestCase, SpanTestCase):
    databases = {"default", "control"}

    def setUp(self):
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

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
                start_ts=self.ten_mins_ago,
                duration=25,
            ),
        ]

        self.store_spans(spans, is_eap=True)

    def test_execute_trace_query_chart_count_metric(self):
        """Test chart query with count() metric using real data"""
        result = execute_trace_query_chart(
            org_id=self.organization.id,
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

    def test_execute_trace_query_chart_multiple_metrics(self):
        """Test chart query with multiple metrics"""
        result = execute_trace_query_chart(
            org_id=self.organization.id,
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

    def test_execute_trace_query_table_basic_query(self):
        """Test table query returns actual span data"""
        result = execute_trace_query_table(
            org_id=self.organization.id,
            query="",
            stats_period="1h",
            sort="-timestamp",
            per_page=10,
        )

        assert result is not None
        assert "data" in result
        assert "meta" in result

        rows = result["data"]
        assert len(rows) == 4  # Should find all 4 spans we created

        # Verify span data
        db_rows = [row for row in rows if row.get("span.op") == "db"]
        assert len(db_rows) == 2  # Two database spans

        http_rows = [row for row in rows if row.get("span.op") == "http.client"]
        assert len(http_rows) == 1  # One HTTP span

        cache_rows = [row for row in rows if row.get("span.op") == "cache.get"]
        assert len(cache_rows) == 1  # One cache span

    def test_execute_trace_query_table_specific_operation(self):
        """Test table query filtering by specific operation"""
        result = execute_trace_query_table(
            org_id=self.organization.id,
            query="span.op:http.client",
            stats_period="1h",
            sort="-timestamp",
        )

        assert result is not None
        rows = result["data"]

        # Should find our http.client span
        http_rows = [row for row in rows if row.get("span.op") == "http.client"]
        assert len(http_rows) == 1

        # Check description contains our external API call
        descriptions = [row.get("span.description", "") for row in http_rows]
        assert any("api.external.com" in desc for desc in descriptions)

    def test_execute_trace_query_chart_empty_results(self):
        """Test chart query with query that returns no results"""
        result = execute_trace_query_chart(
            org_id=self.organization.id,
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

    def test_execute_trace_query_table_empty_results(self):
        """Test table query with query that returns no results"""
        result = execute_trace_query_table(
            org_id=self.organization.id,
            query="span.op:nonexistent",
            stats_period="1h",
            sort="-timestamp",
        )

        assert result is not None
        assert "data" in result
        assert len(result["data"]) == 0

    def test_execute_trace_query_chart_duration_filtering(self):
        """Test chart query with duration filter"""
        result = execute_trace_query_chart(
            org_id=self.organization.id,
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

    def test_execute_trace_query_table_duration_stats(self):
        """Test table query with duration statistics"""
        result = execute_trace_query_table(
            org_id=self.organization.id,
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

    def test_execute_trace_query_nonexistent_organization(self):
        """Test queries handle nonexistent organization gracefully"""
        chart_result = execute_trace_query_chart(
            org_id=99999,
            query="",
            stats_period="1h",
            y_axes=["count()"],
        )
        assert chart_result is None

        table_result = execute_trace_query_table(
            org_id=99999,
            query="",
            stats_period="1h",
            sort="-count",
        )
        assert table_result is None

    def test_execute_trace_query_chart_with_groupby(self):
        """Test chart query with group_by parameter for aggregates"""
        result = execute_trace_query_chart(
            org_id=self.organization.id,
            query="",
            stats_period="1h",
            y_axes=["count()"],
            group_by=["span.op"],
        )

        assert result is not None
        # Grouped results have group values as top-level keys
        # Should have different span.op values like "db", "http.client", etc.
        assert len(result) > 0

        # Each group should have the metric
        for group_value, metrics in result.items():
            if isinstance(metrics, dict) and "count()" in metrics:
                assert "data" in metrics["count()"]

    def test_execute_trace_query_table_with_groupby(self):
        """Test table query with group_by for aggregates mode"""
        result = execute_trace_query_table(
            org_id=self.organization.id,
            query="",
            stats_period="1h",
            sort="-count()",
            group_by=["span.op"],
            y_axes=["count()"],
            per_page=10,
        )

        assert result is not None
        assert "data" in result
        assert "meta" in result

        rows = result["data"]
        # Should have one row per unique span.op value
        assert len(rows) > 0

        # Each row should have span.op and count()
        for row in rows:
            assert "span.op" in row
            assert "count()" in row

    def test_get_organization_project_ids(self):
        """Test the get_organization_project_ids RPC method"""
        from sentry.seer.endpoints.seer_rpc import get_organization_project_ids

        # Test with valid organization
        result = get_organization_project_ids(org_id=self.organization.id)
        assert "project_ids" in result
        assert isinstance(result["project_ids"], list)
        assert self.project.id in result["project_ids"]

        # Test with nonexistent organization
        result = get_organization_project_ids(org_id=99999)
        assert result == {"project_ids": []}
