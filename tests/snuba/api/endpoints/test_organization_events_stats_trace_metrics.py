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

    def test_simple(self) -> None:
        metric_values = [1, 2, 3, 4]

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

    def test_per_second_function(self) -> None:
        metrics = []

        # Only place events in the first bucket to save time in the test
        for _ in range(36):
            metrics.append(
                self.create_trace_metric(
                    "test_metric", 1.0, timestamp=self.start + timedelta(hours=0)
                )
            )
        self.store_trace_metrics(metrics)

        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "per_second()",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 4

        assert response.data["data"][0][1][0]["count"] == pytest.approx(0.01, abs=0.001)
