from datetime import timedelta

from django.urls import reverse

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
        self.features = {"organizations:data-browsing-heat-map-widget": True}

        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def _do_request(self, data, url=None, features=None):
        with self.feature(self.features):
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
