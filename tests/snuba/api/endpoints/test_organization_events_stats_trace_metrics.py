from datetime import timedelta

import pytest

from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsStatsTraceMetricsEndpointTest(OrganizationEventsEndpointTestBase):
    dataset = "tracemetrics"
    viewname = "sentry-api-0-organization-events-stats"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.start = self.day_ago = before_now(days=1).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        self.end = self.start + timedelta(hours=4)

    def test_simple_deprecated(self) -> None:
        metric_values = [1, 2, 3, 4]

        trace_metrics = [
            self.create_trace_metric(
                metric_name, metric_value, "counter", timestamp=self.start + timedelta(hours=i)
            )
            for metric_name in ["foo", "bar"]
            for i, metric_value in enumerate(metric_values)
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "sum(value)",
                "query": "metric.name:foo metric.type:counter",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert [bucket for _, bucket in response.data["data"]] == [
            [{"count": value}] for value in metric_values
        ]

    def test_simple(self) -> None:
        metric_values = [1, 2, 3, 4]

        trace_metrics = [
            self.create_trace_metric(
                metric_name, metric_value, "counter", timestamp=self.start + timedelta(hours=i)
            )
            for metric_name in ["foo", "bar"]
            for i, metric_value in enumerate(metric_values)
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "metricName": "foo",
                "metricType": "counter",
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "sum(value)",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert [bucket for _, bucket in response.data["data"]] == [
            [{"count": value}] for value in metric_values
        ]

    def test_per_second_function(self) -> None:
        metrics = []

        # Only place events in the first bucket to save time in the test
        for _ in range(36):
            metrics.append(
                self.create_trace_metric(
                    "test_metric", 1.0, "counter", timestamp=self.start + timedelta(hours=0)
                )
            )
        self.store_trace_metrics(metrics)

        response = self.do_request(
            {
                "metricName": "test_metric",
                "metricType": "counter",
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "per_second(value, test_metric, counter, -)",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 4

        assert response.data["data"][0][1][0]["count"] == pytest.approx(0.01, abs=0.001)

    def test_top_events(self) -> None:
        metric_values = [6, 0, 6, 3, 0, 3]

        trace_metrics = [
            self.create_trace_metric(
                "foo",
                1,
                "counter",
                timestamp=self.start + timedelta(hours=1),
                attributes={"key": "value1"},
            ),
            self.create_trace_metric(
                "bar",
                1,
                "counter",
                timestamp=self.start + timedelta(hours=1),
                attributes={"key": "value3"},
            ),
        ]

        for hour, count in enumerate(metric_values):
            trace_metrics.append(
                self.create_trace_metric(
                    "bar",
                    count,
                    "counter",
                    timestamp=self.start + timedelta(hours=hour),
                    attributes={"key": "value1"},
                )
            )
            trace_metrics.append(
                self.create_trace_metric(
                    "bar",
                    count,
                    "counter",
                    timestamp=self.start + timedelta(hours=hour),
                    attributes={"key": "value2"},
                )
            )
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "metricName": "bar",
                "metricType": "counter",
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "sum(value)",
                "field": ["key", "sum(value)"],
                "orderby": ["-sum(value)"],
                "project": self.project.id,
                "dataset": self.dataset,
                "excludeOther": 0,
                "topEvents": 2,
            }
        )
        assert response.status_code == 200, response.content
        for key in ["value1", "value2"]:
            rows = response.data[key]["data"][0:6]
            for expected, result in zip(metric_values, rows):
                assert result[1][0]["count"] == expected, key

        rows = response.data["Other"]["data"][0:6]
        for expected, result in zip([0, 1, 0, 0, 0, 0], rows):
            assert result[1][0]["count"] == expected, "Other"

        assert response.data["value1"]["meta"]["dataset"] == "tracemetrics"
        assert response.data["value2"]["meta"]["dataset"] == "tracemetrics"
        assert response.data["Other"]["meta"]["dataset"] == "tracemetrics"

    def test_meta_accuracy(self):
        metric_values = [1, 2, 3, 4]

        trace_metrics = [
            self.create_trace_metric(
                metric_name, metric_value, "counter", timestamp=self.start + timedelta(hours=i)
            )
            for metric_name in ["foo", "bar"]
            for i, metric_value in enumerate(metric_values)
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "metricName": "foo",
                "metricType": "counter",
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": ["sum(value)", "per_second(value)"],
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content

        for y_axis in ["sum(value)", "per_second(value)"]:
            assert [
                bucket["value"]
                for bucket in response.data[y_axis]["meta"]["accuracy"]["sampleCount"]
            ] == [1 for _ in metric_values]
