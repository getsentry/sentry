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
