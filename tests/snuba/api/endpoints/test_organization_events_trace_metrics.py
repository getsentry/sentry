from unittest import mock

import pytest

from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsTraceMetricsEndpointTest(OrganizationEventsEndpointTestBase):
    dataset = "tracemetrics"

    def test_simple(self) -> None:
        trace_metrics = [
            self.create_trace_metric("foo", 1),
            self.create_trace_metric("bar", 2),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "field": ["metric.name", "value"],
                "orderby": "value",
                "query": "metric.name:foo",
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "metric.name": "foo",
                "value": 1,
            },
        ]

    def test_simple_aggregation(self) -> None:
        trace_metrics = [
            self.create_trace_metric("foo", 1),
            self.create_trace_metric("bar", 2),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "field": ["metric.name", "sum(value)"],
                "query": "metric.name:foo",
                "orderby": "sum(value)",
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "metric.name": "foo",
                "sum(value)": 1,
            },
        ]

    def test_per_minute_formula(self) -> None:
        # Store 6 trace metrics over a 10 minute period
        for _ in range(6):
            self.store_trace_metrics([self.create_trace_metric("test_metric", 1.0)])

        response = self.do_request(
            {
                "field": ["per_minute(test_metric)"],
                "query": "",
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["per_minute(test_metric)"] == 0.6
        assert meta["fields"]["per_minute(test_metric)"] == "rate"
        assert meta["dataset"] == "tracemetrics"

    def test_per_second_formula(self) -> None:
        # Store 6 trace metrics over a 10 minute period
        for _ in range(6):
            self.store_trace_metrics([self.create_trace_metric("test_metric", 1.0)])

        response = self.do_request(
            {
                "field": ["per_second(test_metric, counter)"],
                "query": "",
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert (
            data[0]["per_second(test_metric, counter)"] == 0.01
        )  # Over ten minute period, 6 events / 600 seconds = 0.01 events per second
        assert meta["fields"]["per_second(test_metric, counter)"] == "rate"
        assert meta["dataset"] == "tracemetrics"

    def test_per_second_formula_with_counter_metric_type(self) -> None:
        counter_metrics = [
            self.create_trace_metric(
                "request_count", 5.0, attributes={"sentry.metric_type": "counter"}
            ),
            self.create_trace_metric(
                "request_count", 3.0, attributes={"sentry.metric_type": "counter"}
            ),
        ]
        self.store_trace_metrics(counter_metrics)

        response = self.do_request(
            {
                "field": ["per_second(request_count,counter)"],
                "query": "metric.name:request_count",
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0] == {"per_second(request_count,counter)": pytest.approx(8 / 600, abs=0.001)}

    def test_per_second_formula_with_gauge_metric_type(self) -> None:
        gauge_metrics = [
            self.create_trace_metric("cpu_usage", 75.0, attributes={"sentry.metric_type": "gauge"}),
            self.create_trace_metric("cpu_usage", 80.0, attributes={"sentry.metric_type": "gauge"}),
        ]
        self.store_trace_metrics(gauge_metrics)

        response = self.do_request(
            {
                "field": [
                    "per_second(cpu_usage, gauge)"
                ],  # Trying space in the formula here to make sure it works.
                "query": "metric.name:cpu_usage",
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0] == {"per_second(cpu_usage, gauge)": pytest.approx(2 / 600, abs=0.001)}
