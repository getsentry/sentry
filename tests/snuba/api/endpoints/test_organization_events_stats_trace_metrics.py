from datetime import timedelta

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
        self.end = self.start + timedelta(hours=6)

    def test_simple(self) -> None:
        metric_values = [1, 2, 3, 4, 5, 6]

        trace_metrics = [
            self.create_trace_metric(
                metric_name, metric_value, timestamp=self.start + timedelta(hours=i)
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
                "query": "metric.name:foo",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert [bucket for _, bucket in response.data["data"]] == [
            [{"count": value}] for value in metric_values
        ]
