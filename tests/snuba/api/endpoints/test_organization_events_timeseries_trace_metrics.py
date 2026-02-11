from datetime import timedelta

from django.urls import reverse

from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase
from tests.snuba.api.endpoints.test_organization_events_timeseries_spans import (
    AnyConfidence,
    build_expected_timeseries,
)

any_confidence = AnyConfidence()


class OrganizationEventsStatsTraceMetricsEndpointTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-timeseries"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.start = self.day_ago = before_now(days=1).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        self.end = self.start + timedelta(hours=6)
        self.two_days_ago = self.day_ago - timedelta(days=1)

        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def _do_request(self, data, url=None, features=None):
        return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_simple(self) -> None:
        metric_values = [6, 0, 6, 3, 0, 3]

        trace_metrics = []
        for hour, value in enumerate(metric_values):
            trace_metrics.extend(
                [
                    self.create_trace_metric(
                        "foo",
                        value,
                        "counter",
                        timestamp=self.start + timedelta(hours=hour),
                    )
                ]
            )
        self.store_trace_metrics(trace_metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "sum(value)",
                "query": "metric.name:foo",
                "project": self.project.id,
                "dataset": "tracemetrics",
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "tracemetrics",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "sum(value)"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 3_600_000, metric_values, ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "number",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_top_events(self) -> None:
        self.store_trace_metrics(
            [
                self.create_trace_metric(
                    "foo",
                    1,
                    "counter",
                    timestamp=self.start + timedelta(minutes=1),
                    attributes={"environment": {"string_value": "prod"}},
                ),
                self.create_trace_metric(
                    "foo",
                    1,
                    "counter",
                    timestamp=self.start + timedelta(minutes=1),
                    attributes={"environment": {"string_value": "dev"}},
                ),
                self.create_trace_metric(
                    "foo",
                    1,
                    "counter",
                    timestamp=self.start + timedelta(minutes=1),
                    attributes={"environment": {"string_value": "prod"}},
                ),
                self.create_trace_metric(
                    "foo",
                    1,
                    "counter",
                    timestamp=self.start + timedelta(minutes=1),
                    attributes={"environment": {"string_value": "dev"}},
                ),
            ]
        )

        self.end = self.start + timedelta(minutes=6)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "sum(value)",
                "groupBy": ["environment"],
                "project": self.project.id,
                "dataset": "tracemetrics",
                "excludeOther": 0,
                "topEvents": 2,
            }
        )

        assert response.status_code == 200, response.content

        assert response.data["meta"] == {
            "dataset": "tracemetrics",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 2

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "sum(value)"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 2, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "environment", "value": "prod"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "number",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "sum(value)"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 2, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "environment", "value": "dev"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "number",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

    def test_timeseries_with_unit_returns_unit_in_meta(self) -> None:
        """Test that when a unit is specified in the aggregate, valueUnit is populated in the timeseries meta."""
        metric_values = [100, 0, 200, 150, 0, 50]

        trace_metrics = []
        for hour, value in enumerate(metric_values):
            if value > 0:
                trace_metrics.append(
                    self.create_trace_metric(
                        "request_duration",
                        value,
                        "distribution",
                        metric_unit="millisecond",
                        timestamp=self.start + timedelta(hours=hour),
                    )
                )
        self.store_trace_metrics(trace_metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count(value,request_duration,distribution,millisecond)",
                "project": self.project.id,
                "dataset": "tracemetrics",
            },
        )
        assert response.status_code == 200, response.content

        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]

        assert timeseries["yAxis"] == "count(value,request_duration,distribution,millisecond)"

        # The valueType should be "integer" since count aggregates return integer
        assert timeseries["meta"]["valueType"] == "integer"
        assert timeseries["meta"]["valueUnit"] is None

    def test_timeseries_count_aggregates_return_integer_in_meta(self) -> None:
        """Test that count aggregates return integer in the timeseries meta."""
        metric_values = [100, 0, 200, 150, 0, 50]

        trace_metrics = []
        for hour, value in enumerate(metric_values):
            if value > 0:
                trace_metrics.append(
                    self.create_trace_metric(
                        "request_duration",
                        value,
                        "distribution",
                        metric_unit="millisecond",
                        timestamp=self.start + timedelta(hours=hour),
                    )
                )
        self.store_trace_metrics(trace_metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "avg(value,request_duration,distribution,millisecond)",
                "project": self.project.id,
                "dataset": "tracemetrics",
            },
        )
        assert response.status_code == 200, response.content

        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]

        assert timeseries["yAxis"] == "avg(value,request_duration,distribution,millisecond)"

        # The valueUnit should be "millisecond" since we specified it in the aggregate
        assert timeseries["meta"]["valueType"] == "duration"
        assert timeseries["meta"]["valueUnit"] == "millisecond"

    def test_timeseries_without_unit_returns_null_unit_in_meta(self) -> None:
        """Test that when no unit is specified (using '-'), valueUnit is null in the timeseries meta."""
        metric_values = [6, 0, 6, 3, 0, 3]

        trace_metrics = []
        for hour, value in enumerate(metric_values):
            trace_metrics.append(
                self.create_trace_metric(
                    "request_count",
                    value,
                    "counter",
                    timestamp=self.start + timedelta(hours=hour),
                )
            )
        self.store_trace_metrics(trace_metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "sum(value,request_count,counter,-)",
                "project": self.project.id,
                "dataset": "tracemetrics",
            },
        )
        assert response.status_code == 200, response.content

        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]

        assert timeseries["yAxis"] == "sum(value,request_count,counter,-)"

        # The valueUnit should be null since we used "-" for unit
        assert timeseries["meta"]["valueType"] == "number"
        assert timeseries["meta"]["valueUnit"] is None
