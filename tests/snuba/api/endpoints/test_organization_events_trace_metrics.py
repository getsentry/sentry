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

    def test_per_minute_formula(self) -> None:
        # Store 6 trace metrics over a 10 minute period
        for _ in range(6):
            self.store_trace_metrics([self.create_trace_metric("test_metric", 1.0)])

        response = self.do_request(
            {
                "field": ["per_minute()"],
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
        assert data[0]["per_minute()"] == 0.6
        assert meta["fields"]["per_minute()"] == "rate"
        assert meta["dataset"] == "tracemetrics"

    def test_per_second_formula(self) -> None:
        # Store 6 trace metrics over a 10 minute period
        for _ in range(6):
            self.store_trace_metrics([self.create_trace_metric("test_metric", 1.0)])

        response = self.do_request(
            {
                "field": ["per_second()"],
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
            data[0]["per_second()"] == 0.01
        )  # Over ten minute period, 6 events / 600 seconds = 0.01 events per second
        assert meta["fields"]["per_second()"] == "rate"
        assert meta["dataset"] == "tracemetrics"
