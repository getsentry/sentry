from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.api.endpoints.organization_events_heatmap import OrganizationEventsHeatmapEndpoint
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import (
    OrganizationEventsEndpointTestBase,
)


class OrganizationEventsHeatmapTraceMetricsEndpointTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-heatmap"
    dataset = "tracemetrics"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.start = self.day_ago = before_now(days=1).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        self.end = self.start + timedelta(hours=6)
        self.two_days_ago = self.day_ago - timedelta(days=1)

        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def _do_request(self, data, url=None, features=None):
        return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_simple(self) -> None:
        metric_values = [6, 0, 6, 3, 0, 3]

        trace_metrics = []
        for hour, value in enumerate(metric_values):
            for i in range(value):
                trace_metrics.append(
                    self.create_trace_metric(
                        "foo",
                        120 * (i + 1),
                        "counter",
                        timestamp=self.start + timedelta(hours=hour),
                    )
                )
        self.store_eap_items(trace_metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=6),
                "yAxis": "value",
                "interval": "1h",
                "yBuckets": 6,
                "query": "metric.name:foo metric.type:counter",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        expected_response = []
        for time in range(6):
            for yAxis in range(6):
                expected_response.append(
                    {
                        "xAxis": (self.start.timestamp() + (3600 * time)) * 1000,
                        "yAxis": 120 + 100 * yAxis,
                        "zAxis": 1 if time in [0, 2] or (time in [3, 5] and yAxis < 3) else 0,
                    }
                )
        assert response.data["values"] == expected_response
        assert response.data["meta"] == {
            "dataset": "tracemetrics",
            "xAxis": {
                "name": "time",
                "start": self.start.timestamp() * 1000,
                "end": self.end.timestamp() * 1000,
                "bucketCount": 6,
                "bucketSize": 3600,
            },
            "yAxis": {
                "name": "value",
                "start": 120,
                "end": 720,
                "bucketCount": 6,
                "bucketSize": 100,
                "logarithmic": False,
            },
            "zAxis": {
                "name": "count()",
                "start": 0,
                "end": 1,
            },
        }

    def test_min_equals_max(self) -> None:
        metric_values = [6, 0, 6, 3, 0, 3]

        trace_metrics = []
        for hour, value in enumerate(metric_values):
            for i in range(value):
                trace_metrics.append(
                    self.create_trace_metric(
                        "foo",
                        100,
                        "counter",
                        timestamp=self.start + timedelta(hours=hour),
                    )
                )
        self.store_eap_items(trace_metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=6),
                "yAxis": "value",
                "interval": "1h",
                "yBuckets": 100,
                "query": "metric.name:foo metric.type:counter",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        expected_response = []
        for time in range(6):
            expected_response.append(
                {
                    "xAxis": (self.start.timestamp() + (3600 * time)) * 1000,
                    "yAxis": 100,
                    "zAxis": metric_values[time],
                }
            )
        assert response.data["values"] == expected_response
        assert response.data["meta"] == {
            "dataset": "tracemetrics",
            "xAxis": {
                "name": "time",
                "start": self.start.timestamp() * 1000,
                "end": self.end.timestamp() * 1000,
                "bucketCount": 6,
                "bucketSize": 3600,
            },
            "yAxis": {
                "name": "value",
                "start": 100,
                "end": 100,
                "bucketCount": 1,
                "bucketSize": 0,
                "logarithmic": False,
            },
            "zAxis": {
                "name": "count()",
                "start": 0,
                "end": 6,
            },
        }

    def test_explicit_zero_value(self) -> None:
        metric_values = [6, 0, 6, 3, 0, 3]

        trace_metrics = []
        for hour, value in enumerate(metric_values):
            trace_metrics.append(
                self.create_trace_metric(
                    "foo",
                    100 * value,
                    "counter",
                    timestamp=self.start + timedelta(hours=hour),
                )
            )
        self.store_eap_items(trace_metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=6),
                "yAxis": "value",
                "interval": "1h",
                "yBuckets": 6,
                "query": "metric.name:foo metric.type:counter",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        expected_response = []
        for time in range(6):
            for yAxis in range(6):
                expected_response.append(
                    {
                        "xAxis": (self.start.timestamp() + (3600 * time)) * 1000,
                        "yAxis": 100 * yAxis,
                        "zAxis": 1 if yAxis == min(metric_values[time], 5) else 0,
                    }
                )

        assert response.data["values"] == expected_response
        assert response.data["meta"] == {
            "dataset": "tracemetrics",
            "xAxis": {
                "name": "time",
                "start": self.start.timestamp() * 1000,
                "end": self.end.timestamp() * 1000,
                "bucketCount": 6,
                "bucketSize": 3600,
            },
            "yAxis": {
                "name": "value",
                "start": 0,
                "end": 600,
                "bucketCount": 6,
                "bucketSize": 100,
                "logarithmic": False,
            },
            "zAxis": {
                "name": "count()",
                "start": 0,
                "end": 1,
            },
        }

    def test_log_scale(self) -> None:
        metric_values = [6, 0, 6, 3, 0, 3]

        trace_metrics = []
        for hour, value in enumerate(metric_values):
            for i in range(value):
                trace_metrics.append(
                    self.create_trace_metric(
                        "foo",
                        10**i if i > 0 else 0,
                        "counter",
                        timestamp=self.start + timedelta(hours=hour),
                    )
                )
        self.store_eap_items(trace_metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=6),
                "yAxis": "value",
                "interval": "1h",
                "yBuckets": 5,
                "yLogScale": 10,
                "query": "metric.name:foo metric.type:counter",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        expected_response = []
        for time in range(6):
            for yAxis in range(5):
                row = {
                    "xAxis": (self.start.timestamp() + (3600 * time)) * 1000,
                    "yAxis": 10**yAxis,
                    "zAxis": 0,
                }
                if time in [0, 2]:
                    if yAxis in [1, 2, 3]:
                        row["zAxis"] = 1
                    elif yAxis == 4:
                        row["zAxis"] = 2
                if time in [3, 5] and yAxis in [1, 2]:
                    row["zAxis"] = 1
                expected_response.append(row)
        assert response.data["values"] == expected_response
        assert response.data["meta"] == {
            "dataset": "tracemetrics",
            "xAxis": {
                "name": "time",
                "start": self.start.timestamp() * 1000,
                "end": self.end.timestamp() * 1000,
                "bucketCount": 6,
                "bucketSize": 3600,
            },
            "yAxis": {
                "name": "value",
                "start": 0,
                "end": 100000,
                "bucketCount": 5,
                "bucketSize": 1,
                "logarithmic": True,
            },
            "zAxis": {
                "name": "count()",
                "start": 0,
                "end": 2,
            },
        }

    def test_log_scale_with_min_max_less_than_one(self) -> None:
        metric_values = [1, 1, 1, 0.5, 0.5, 0.5]

        trace_metrics = []
        for hour, value in enumerate(metric_values):
            trace_metrics.append(
                self.create_trace_metric(
                    "foo",
                    value,
                    "counter",
                    timestamp=self.start + timedelta(hours=hour),
                )
            )
        self.store_eap_items(trace_metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=6),
                "yAxis": "value",
                "interval": "1h",
                "yBuckets": 2,
                "yLogScale": 10,
                "query": "metric.name:foo metric.type:counter",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        expected_response = []
        for time in range(6):
            for yAxis in range(2):
                expected_response.append(
                    {
                        "xAxis": (self.start.timestamp() + (3600 * time)) * 1000,
                        "yAxis": 0.5 + 0.25 * yAxis,
                        "zAxis": 1
                        if (time < 3 and yAxis == 1) or (time >= 3 and yAxis == 0)
                        else 0,
                    }
                )
        assert response.data["values"] == expected_response
        assert response.data["meta"] == {
            "dataset": "tracemetrics",
            "xAxis": {
                "name": "time",
                "start": self.start.timestamp() * 1000,
                "end": self.end.timestamp() * 1000,
                "bucketCount": 6,
                "bucketSize": 3600,
            },
            "yAxis": {
                "name": "value",
                "start": 0.5,
                "end": 1,
                "bucketCount": 2,
                "bucketSize": 0.25,
                # Won't use log since the range is less than 1
                "logarithmic": False,
            },
            "zAxis": {
                "name": "count()",
                "start": 0,
                "end": 1,
            },
        }

    def test_invalid_log_scale(self):
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=6),
                "yAxis": "value",
                "interval": "1h",
                "yBuckets": 5,
                "yLogScale": 1,
                "query": "metric.name:foo metric.type:counter",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 400, response.content
        assert response.data["detail"] == "logScale cannot be 1"

    def test_very_small_float_values(self) -> None:
        # Values like 8.527e-06 would previously be formatted in scientific
        # notation inside the query string, which the search query parser rejects.
        small_values = [0.000008, 0.000009, 0.000010, 0.000011]

        trace_metrics = []
        for hour, value in enumerate(small_values):
            trace_metrics.append(
                self.create_trace_metric(
                    "foo",
                    value,
                    "counter",
                    timestamp=self.start + timedelta(hours=hour),
                )
            )
        self.store_eap_items(trace_metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=6),
                "yAxis": "value",
                "interval": "1h",
                "yBuckets": 4,
                "query": "metric.name:foo metric.type:counter",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"]["yAxis"]["start"] == pytest.approx(0.000008, rel=1e-3)
        assert response.data["meta"]["yAxis"]["end"] == pytest.approx(0.000011, rel=1e-3)

    def test_very_small_float_min_equals_max(self) -> None:
        # When min == max and the value is very small, the single-bucket query
        # must also use plain decimal notation rather than scientific notation.
        trace_metrics = [
            self.create_trace_metric(
                "foo",
                0.000008527,
                "counter",
                timestamp=self.start + timedelta(hours=hour),
            )
            for hour in range(3)
        ]
        self.store_eap_items(trace_metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=6),
                "yAxis": "value",
                "interval": "1h",
                "yBuckets": 10,
                "query": "metric.name:foo metric.type:counter",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"]["yAxis"]["bucketCount"] == 1
        assert response.data["meta"]["yAxis"]["start"] == pytest.approx(0.000008527, rel=1e-3)

    def test_pinned_bounds_applied(self) -> None:
        # Pinning yMin/yMax wider than the data forces those bounds onto the grid
        # instead of the auto-derived data min/max (120/720).
        metric_values = [120, 240, 360, 480, 600, 720]
        trace_metrics = [
            self.create_trace_metric(
                "foo",
                value,
                "counter",
                timestamp=self.start + timedelta(hours=hour),
            )
            for hour, value in enumerate(metric_values)
        ]
        self.store_eap_items(trace_metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=6),
                "yAxis": "value",
                "interval": "1h",
                "yBuckets": 6,
                "yMin": 0,
                "yMax": 1200,
                "query": "metric.name:foo metric.type:counter",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"]["yAxis"]["start"] == 0
        assert response.data["meta"]["yAxis"]["end"] == 1200
        assert response.data["meta"]["yAxis"]["bucketSize"] == 200
        # Edges follow the pinned domain (0..1200 in 6 buckets), not the data (120..720).
        assert sorted({row["yAxis"] for row in response.data["values"]}) == [
            0,
            200,
            400,
            600,
            800,
            1000,
        ]

    def test_pinned_bounds_validation_errors(self) -> None:
        base_data = {
            "start": self.start,
            "end": self.start + timedelta(hours=6),
            "yAxis": "value",
            "interval": "1h",
            "yBuckets": 6,
            "query": "metric.name:foo metric.type:counter",
            "project": self.project.id,
            "dataset": self.dataset,
        }
        cases: list[tuple[dict[str, object], str]] = [
            ({"yMin": 120}, "yMin and yMax must be provided together"),
            ({"yMin": "abc", "yMax": 720}, "yMin and yMax must be numbers"),
            ({"yMin": 720, "yMax": 120}, "yMax must be greater than or equal to yMin"),
            # nan/inf pass float() but would break the bucket math and JSON serialization.
            ({"yMin": "nan", "yMax": "nan"}, "yMin and yMax must be finite numbers"),
            ({"yMin": 0, "yMax": "inf"}, "yMin and yMax must be finite numbers"),
        ]
        for params, detail in cases:
            response = self._do_request(data={**base_data, **params})
            assert response.status_code == 400, response.content
            assert response.data["detail"] == detail


class TestFormatLongFloat:
    def test_small_number_no_scientific_notation(self) -> None:
        result = OrganizationEventsHeatmapEndpoint._format_long_float(8.527e-06)
        assert "e" not in result
        assert "E" not in result
        assert result == "0.000008527"

    def test_normal_number(self) -> None:
        result = OrganizationEventsHeatmapEndpoint._format_long_float(123.456)
        assert "e" not in result
        assert result == "123.456"

    def test_huge_number_no_scientific_notation(self) -> None:
        result = OrganizationEventsHeatmapEndpoint._format_long_float(
            123456789012345678901234567890
        )
        assert "e" not in result
        assert "E" not in result
        assert result == "123456789012345678901234567890"

    def test_zero(self) -> None:
        result = OrganizationEventsHeatmapEndpoint._format_long_float(0.0)
        assert result == "0.0"

    def test_very_small_number_is_parseable(self) -> None:
        # Ensure the formatted string looks like a plain decimal Python float
        result = OrganizationEventsHeatmapEndpoint._format_long_float(1.23e-10)
        assert "e" not in result
        assert "E" not in result
        float(result)  # must not raise
