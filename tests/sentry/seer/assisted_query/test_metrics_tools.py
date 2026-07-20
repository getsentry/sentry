from unittest.mock import MagicMock, patch

from sentry.api.client import ApiError
from sentry.seer.assisted_query.metrics_tools import (
    _build_or_query,
    get_metric_metadata,
)
from sentry.seer.sentry_data_models import MetricMetadataSuccessResponse
from sentry.testutils.cases import (
    APITransactionTestCase,
    SnubaTestCase,
    TestCase,
    TraceMetricsTestCase,
)
from sentry.testutils.helpers.datetime import before_now


class TestBuildOrQuery(TestCase):
    def test_single_substring(self) -> None:
        assert _build_or_query(["http"]) == 'metric.name:"*http*"'

    def test_multiple_substrings_joined_with_or(self) -> None:
        assert _build_or_query(["http", "api"]) == '(metric.name:"*http*" OR metric.name:"*api*")'

    def test_rejects_substrings_with_quotes(self) -> None:
        # Substrings containing double-quotes would break the search grammar.
        # They should be silently dropped rather than trigger a parse error.
        assert _build_or_query(['foo"bar']) == ""

    def test_all_rejected_returns_empty(self) -> None:
        assert _build_or_query(['"']) == ""


class TestGetMetricMetadata(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)

    @patch("sentry.seer.assisted_query.metrics_tools.ApiClient")
    def test_returns_distinct_tuples_with_count(self, mock_client_cls: MagicMock) -> None:
        mock_client = mock_client_cls.return_value
        response = MagicMock()
        response.data = [
            {
                "name": "http.request.duration",
                "type": "distribution",
                "unit": "millisecond",
                "count": 1200,
            },
            {
                "name": "api.request.count",
                "type": "counter",
                "unit": "none",
                "count": 800,
            },
        ]
        mock_client.get.return_value = response

        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=["http", "api"],
            stats_period="7d",
            limit=10,
        )

        assert result.has_more is False
        assert len(result.candidates) == 2
        dist = result.candidates[0]
        assert dist.name == "http.request.duration"
        assert dist.type == "distribution"
        assert dist.unit == "millisecond"
        assert dist.count == 1200

        # Assert we hit the metrics endpoint with the expected params.
        _args, kwargs = mock_client.get.call_args
        assert kwargs["path"] == f"/organizations/{self.org.slug}/trace-items/metrics/"
        params = kwargs["params"]
        assert params["sort"] == "-count"
        assert params["query"] == '(metric.name:"*http*" OR metric.name:"*api*")'
        # over-fetch by 1 to detect has_more
        assert params["per_page"] == 11
        # No events-layer params leak through.
        assert "dataset" not in params
        assert "field" not in params

    @patch("sentry.seer.assisted_query.metrics_tools.ApiClient")
    def test_empty_substrings_short_circuits(self, mock_client_cls: MagicMock) -> None:
        mock_client = mock_client_cls.return_value
        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=[],
        )
        assert result.dict() == {"candidates": [], "has_more": False}
        mock_client.get.assert_not_called()

    @patch("sentry.seer.assisted_query.metrics_tools.ApiClient")
    def test_has_more_when_result_exceeds_limit(self, mock_client_cls: MagicMock) -> None:
        mock_client = mock_client_cls.return_value
        # Asking for limit=2 means we over-fetch 3. If we actually see 3, has_more=True.
        response = MagicMock()
        response.data = [
            {"name": f"m.{i}", "type": "counter", "unit": "none", "count": 100 - i}
            for i in range(3)
        ]
        mock_client.get.return_value = response

        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=["m"],
            limit=2,
        )
        assert result.has_more is True
        assert len(result.candidates) == 2

    @patch("sentry.seer.assisted_query.metrics_tools.ApiClient")
    def test_has_more_uses_raw_row_count_not_filtered_count(
        self, mock_client_cls: MagicMock
    ) -> None:
        mock_client = mock_client_cls.return_value
        """Regression: has_more must be computed from what Sentry returned, not
        from what survived our local parse filter. We over-fetch by 1 specifically
        to detect \"Sentry has more matches than you asked for\"; filtering a
        malformed row shouldn't hide that signal from the caller."""
        # limit=2, per_page=3. Return 3 rows where one is malformed.
        # Post-filter: 2 candidates (== limit). Pre-filter: 3 rows (> limit).
        response = MagicMock()
        response.data = [
            {"name": "a", "type": "counter", "unit": "none", "count": 30},
            # Malformed — will be filtered out locally.
            {"name": None, "type": "counter", "unit": "none"},
            {"name": "b", "type": "counter", "unit": "none", "count": 20},
        ]
        mock_client.get.return_value = response

        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=["x"],
            limit=2,
        )

        assert result.has_more is True
        assert len(result.candidates) == 2

    @patch("sentry.seer.assisted_query.metrics_tools.ApiClient")
    def test_skips_rows_missing_name_or_type(self, mock_client_cls: MagicMock) -> None:
        mock_client = mock_client_cls.return_value
        response = MagicMock()
        response.data = [
            {"name": "good", "type": "counter", "unit": "none", "count": 10},
            {"name": "", "type": "counter", "unit": "none"},
            {"name": "no-type", "type": None, "unit": "none"},
        ]
        mock_client.get.return_value = response

        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=["x"],
        )
        assert len(result.candidates) == 1
        assert result.candidates[0].name == "good"

    @patch("sentry.seer.assisted_query.metrics_tools.ApiClient")
    def test_missing_unit_defaults_to_none(self, mock_client_cls: MagicMock) -> None:
        mock_client = mock_client_cls.return_value
        response = MagicMock()
        response.data = [{"name": "foo", "type": "counter", "unit": None, "count": 5}]
        mock_client.get.return_value = response

        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=["foo"],
        )
        assert result.candidates[0].unit == "none"

    @patch("sentry.seer.assisted_query.metrics_tools.ApiClient")
    def test_feature_gated_404_returns_empty(self, mock_client_cls: MagicMock) -> None:
        # Org lacks the feature-gated metrics endpoint → empty result, not a failure.
        mock_client = mock_client_cls.return_value
        mock_client.get.side_effect = ApiError(404, None)

        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=["foo"],
        )

        assert result.dict() == {"candidates": [], "has_more": False}

    @patch("sentry.seer.assisted_query.metrics_tools.ApiClient")
    def test_organization_not_found_returns_error(self, mock_client_cls: MagicMock) -> None:
        mock_client = mock_client_cls.return_value
        """Missing organization must surface as an explicit error code, not a silent
        empty result. Seer translates the error key into success=False so Langfuse
        traces distinguish real failures from sparse metric catalogs."""
        # Pass a non-existent org_id; the handler should catch DoesNotExist.
        result = get_metric_metadata(
            org_id=99999999,
            project_ids=[self.project.id],
            name_substrings=["foo"],
        )

        assert result.dict() == {
            "candidates": [],
            "has_more": False,
            "error": "organization_not_found",
        }
        # No metrics query should be attempted.
        mock_client.get.assert_not_called()

    @patch("sentry.seer.assisted_query.metrics_tools.ApiClient")
    def test_metrics_query_failure_returns_error(self, mock_client_cls: MagicMock) -> None:
        """When the underlying metrics API raises ApiError, return an explicit
        error code rather than a silent empty result."""
        mock_client = mock_client_cls.return_value
        mock_client.get.side_effect = ApiError(500, "snuba exploded")

        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=["foo"],
        )

        assert result.dict() == {
            "candidates": [],
            "has_more": False,
            "error": "metrics_query_failed",
        }
        mock_client.get.assert_called_once()


class TestGetMetricMetadataIntegration(APITransactionTestCase, SnubaTestCase, TraceMetricsTestCase):
    """End-to-end test against the real trace-items metrics endpoint.

    The mock-based tests above never exercise the metrics endpoint's query
    parser. This class persists real TraceItems and lets the handler's
    in-process client.get call hit the actual endpoint, so a regression in the
    query/aggregate shape surfaces here.
    """

    def setUp(self) -> None:
        super().setUp()
        ts = before_now(minutes=5)
        self.store_eap_items(
            [
                self.create_trace_metric(
                    metric_name="http.request.duration",
                    metric_value=100.0,
                    metric_type="distribution",
                    metric_unit="millisecond",
                    timestamp=ts,
                ),
                self.create_trace_metric(
                    metric_name="http.request.duration",
                    metric_value=200.0,
                    metric_type="distribution",
                    metric_unit="millisecond",
                    timestamp=ts,
                ),
                self.create_trace_metric(
                    metric_name="api.request.count",
                    metric_value=1.0,
                    metric_type="counter",
                    timestamp=ts,
                ),
            ]
        )

    def test_returns_candidates_matching_substring(self) -> None:
        with self.feature(
            {
                "organizations:visibility-explore-view": True,
                "organizations:tracemetrics-enabled": True,
            }
        ):
            result = get_metric_metadata(
                org_id=self.organization.id,
                project_ids=[self.project.id],
                name_substrings=["http"],
                stats_period="1h",
            )

        # A broken query would short-circuit into metrics_query_failed.
        assert isinstance(result, MetricMetadataSuccessResponse), result
        names = {c.name for c in result.candidates}
        assert "http.request.duration" in names
        assert "api.request.count" not in names

        http_row = next(c for c in result.candidates if c.name == "http.request.duration")
        assert http_row.type == "distribution"
        assert http_row.unit == "millisecond"
        assert http_row.count == 2
