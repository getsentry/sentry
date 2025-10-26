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

    def test_rate_function(self) -> None:
        for i in range(6):
            for _ in range(2):
                self.store_trace_metrics(
                    [
                        self.create_trace_metric(
                            "test_metric", 1.0, timestamp=self.start + timedelta(hours=i)
                        )
                    ]
                )

        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "rate(3600)",  # 3600 seconds = 1 hour
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 6
        # Each bucket should have 2 events / 3600 seconds = 0.000555... events per second
        for _, bucket in response.data["data"]:
            assert abs(bucket[0]["count"] - (2 / 3600)) < 0.0001
