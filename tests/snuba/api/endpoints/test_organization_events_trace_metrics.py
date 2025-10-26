from unittest import mock

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

    def test_rate_formula(self) -> None:
        # Store 6 trace metrics over a 10 minute period
        for _ in range(6):
            self.store_trace_metrics([self.create_trace_metric("test_metric", 1.0)])

        response = self.do_request(
            {
                "field": ["rate(60)"],
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
        # 6 events / 60 seconds = 0.1 events per second
        assert data[0]["rate(60)"] == 0.1
        assert meta["fields"]["rate(60)"] == "rate"
        assert meta["units"]["rate(60)"] == "1/second"
        assert meta["dataset"] == "tracemetrics"

    def test_rate_formula_validation_divisor_too_large(self) -> None:
        self.store_trace_metrics([self.create_trace_metric("test_metric", 1.0)])

        # Test with divisor larger than interval (600 seconds for 10m period)
        response = self.do_request(
            {
                "field": ["rate(700)"],
                "query": "",
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 400, response.content

    def test_rate_formula_validation_divisor_not_divisible(self) -> None:
        self.store_trace_metrics([self.create_trace_metric("test_metric", 1.0)])

        # Test with divisor that doesn't divide evenly into interval (600 seconds for 10m period)
        response = self.do_request(
            {
                "field": ["rate(7)"],
                "query": "",
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 400, response.content

    def test_rate_formula_no_params(self) -> None:
        # Store 6 trace metrics over a 10 minute period
        for _ in range(6):
            self.store_trace_metrics([self.create_trace_metric("test_metric", 1.0)])

        response = self.do_request(
            {
                "field": ["rate()"],
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
        # 6 events / 1 second = 6 events per second
        assert data[0]["rate()"] == 6.0
        assert meta["fields"]["rate()"] == "rate"
        assert meta["units"]["rate()"] == "1/second"
        assert meta["dataset"] == "tracemetrics"
