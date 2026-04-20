from unittest.mock import MagicMock, patch

from sentry.seer.assisted_query.metrics_tools import (
    _build_or_query,
    get_metric_metadata,
)
from sentry.testutils.cases import TestCase


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

    @patch("sentry.seer.assisted_query.metrics_tools.client")
    def test_returns_distinct_tuples_with_count(self, mock_client: MagicMock) -> None:
        response = MagicMock()
        response.data = {
            "data": [
                {
                    "metric.name": "http.request.duration",
                    "metric.type": "distribution",
                    "metric.unit": "millisecond",
                    "count()": 1200,
                },
                {
                    "metric.name": "api.request.count",
                    "metric.type": "counter",
                    "metric.unit": "none",
                    "count()": 800,
                },
            ]
        }
        mock_client.get.return_value = response

        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=["http", "api"],
            stats_period="7d",
            limit=10,
        )

        assert result["has_more"] is False
        assert len(result["candidates"]) == 2
        dist = result["candidates"][0]
        assert dist["name"] == "http.request.duration"
        assert dist["type"] == "distribution"
        assert dist["unit"] == "millisecond"
        assert dist["count"] == 1200

        # Assert query params carry the expected shape.
        _args, kwargs = mock_client.get.call_args
        params = kwargs["params"]
        assert params["dataset"] == "tracemetrics"
        assert params["field"] == [
            "metric.name",
            "metric.type",
            "metric.unit",
            "count()",
        ]
        assert params["sort"] == "-count()"
        assert params["query"] == '(metric.name:"*http*" OR metric.name:"*api*")'
        # over-fetch by 1 to detect has_more
        assert params["per_page"] == 11

    @patch("sentry.seer.assisted_query.metrics_tools.client")
    def test_empty_substrings_short_circuits(self, mock_client: MagicMock) -> None:
        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=[],
        )
        assert result == {"candidates": [], "has_more": False}
        mock_client.get.assert_not_called()

    @patch("sentry.seer.assisted_query.metrics_tools.client")
    def test_has_more_when_result_exceeds_limit(self, mock_client: MagicMock) -> None:
        # Asking for limit=2 means we over-fetch 3. If we actually see 3, has_more=True.
        response = MagicMock()
        response.data = {
            "data": [
                {
                    "metric.name": f"m.{i}",
                    "metric.type": "counter",
                    "metric.unit": "none",
                    "count()": 100 - i,
                }
                for i in range(3)
            ]
        }
        mock_client.get.return_value = response

        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=["m"],
            limit=2,
        )
        assert result["has_more"] is True
        assert len(result["candidates"]) == 2

    @patch("sentry.seer.assisted_query.metrics_tools.client")
    def test_skips_rows_missing_name_or_type(self, mock_client: MagicMock) -> None:
        response = MagicMock()
        response.data = {
            "data": [
                {
                    "metric.name": "good",
                    "metric.type": "counter",
                    "metric.unit": "none",
                    "count()": 10,
                },
                {"metric.name": "", "metric.type": "counter", "metric.unit": "none"},
                {"metric.name": "no-type", "metric.type": None, "metric.unit": "none"},
            ]
        }
        mock_client.get.return_value = response

        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=["x"],
        )
        assert len(result["candidates"]) == 1
        assert result["candidates"][0]["name"] == "good"

    @patch("sentry.seer.assisted_query.metrics_tools.client")
    def test_missing_unit_defaults_to_none(self, mock_client: MagicMock) -> None:
        response = MagicMock()
        response.data = {
            "data": [
                {
                    "metric.name": "foo",
                    "metric.type": "counter",
                    "metric.unit": None,
                    "count()": 5,
                }
            ]
        }
        mock_client.get.return_value = response

        result = get_metric_metadata(
            org_id=self.org.id,
            project_ids=[self.project.id],
            name_substrings=["foo"],
        )
        assert result["candidates"][0]["unit"] == "none"
