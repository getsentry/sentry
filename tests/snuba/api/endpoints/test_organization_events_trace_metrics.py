from unittest import mock

import pytest
from rest_framework.exceptions import ErrorDetail

from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsTraceMetricsEndpointTest(OrganizationEventsEndpointTestBase):
    dataset = "tracemetrics"

    def test_missing_metric_name_and_type(self):
        with self.feature("organizations:tracemetrics-top-level-params"):
            response = self.do_request(
                {
                    "field": ["sum(value)"],
                    "dataset": self.dataset,
                    "project": self.project.id,
                }
            )
            assert response.status_code == 400, response.content
            assert response.data == {
                "metricName": ErrorDetail("This field is required.", code="required"),
                "metricType": ErrorDetail("This field is required.", code="required"),
            }

    def test_invalid_metric_type(self):
        with self.feature("organizations:tracemetrics-top-level-params"):
            response = self.do_request(
                {
                    "metricName": "foo",
                    "metricType": "bar",
                    "field": ["sum(value)"],
                    "dataset": self.dataset,
                    "project": self.project.id,
                }
            )
            assert response.status_code == 400, response.content
            assert response.data == {
                "metricType": ErrorDetail('"bar" is not a valid choice.', code="invalid_choice"),
            }

    def test_simple_deprecated(self) -> None:
        trace_metrics = [
            self.create_trace_metric("foo", 1, "counter"),
            self.create_trace_metric("bar", 2, "counter"),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "field": ["metric.name", "value"],
                "query": "metric.name:foo metric.type:counter",
                "orderby": "value",
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

    def test_simple_aggregation_deprecated(self) -> None:
        trace_metrics = [
            self.create_trace_metric("foo", 1, "counter"),
            self.create_trace_metric("bar", 2, "counter"),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "field": ["metric.name", "sum(value)"],
                "query": "metric.name:foo metric.type:counter",
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

    def test_simple(self) -> None:
        trace_metrics = [
            self.create_trace_metric("foo", 1, "counter"),
            self.create_trace_metric("bar", 2, "counter"),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "metricName": "foo",
                "metricType": "counter",
                "field": ["metric.name", "value"],
                "orderby": "value",
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
            self.create_trace_metric("foo", 1, "counter"),
            self.create_trace_metric("bar", 2, "counter"),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "metricName": "foo",
                "metricType": "counter",
                "field": ["metric.name", "sum(value)"],
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
            self.store_trace_metrics([self.create_trace_metric("test_metric", 1.0, "counter")])

        response = self.do_request(
            {
                "metricName": "test_metric",
                "metricType": "counter",
                "field": ["per_minute(test_metric)"],
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
            self.store_trace_metrics([self.create_trace_metric("test_metric", 1.0, "counter")])

        response = self.do_request(
            {
                "metricName": "test_metric",
                "metricType": "counter",
                "field": ["per_second(test_metric, counter)"],
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
            self.create_trace_metric("request_count", 5.0, "counter"),
            self.create_trace_metric("request_count", 3.0, "counter"),
        ]
        self.store_trace_metrics(counter_metrics)

        response = self.do_request(
            {
                "metricName": "request_count",
                "metricType": "counter",
                "field": ["per_second(request_count,counter)"],
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
            self.create_trace_metric("cpu_usage", 75.0, "gauge"),
            self.create_trace_metric("cpu_usage", 80.0, "gauge"),
        ]
        self.store_trace_metrics(gauge_metrics)

        response = self.do_request(
            {
                "metricName": "cpu_usage",
                "metricType": "gauge",
                "field": [
                    "per_second(cpu_usage, gauge)"
                ],  # Trying space in the formula here to make sure it works.
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0] == {"per_second(cpu_usage, gauge)": pytest.approx(2 / 600, abs=0.001)}

    def test_per_second_formula_with_gauge_metric_type_without_top_level_metric_type(self) -> None:
        gauge_metrics = [
            self.create_trace_metric("cpu_usage", 75.0, "gauge"),
            self.create_trace_metric("cpu_usage", 80.0, "gauge"),
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
