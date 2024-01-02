from datetime import timedelta
from unittest.mock import patch

import pytest
from django.urls import reverse

from sentry.search.events import constants
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test

pytestmark = pytest.mark.sentry_metrics


@region_silo_test
class OrganizationEventsStatsSpansMetricsEndpointTest(MetricsEnhancedPerformanceTestCase):
    endpoint = "sentry-api-0-organization-events-stats"
    METRIC_STRINGS = [
        "foo_transaction",
    ]

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.DEFAULT_METRIC_TIMESTAMP = self.day_ago

        self.url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        self.features = {
            "organizations:performance-use-metrics": True,
        }

    def do_request(self, data, url=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    # These throughput tests should roughly match the ones in OrganizationEventsStatsEndpointTest
    def test_throughput_epm_hour_rollup(self):
        # Each of these denotes how many events to create in each hour
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_span_metric(
                    1,
                    internal_metric=constants.SELF_TIME_LIGHT,
                    timestamp=self.day_ago + timedelta(hours=hour, minutes=minute),
                )

        for axis in ["epm()", "spm()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=6)),
                    "interval": "1h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": "spansMetrics",
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["meta"]["dataset"] == "spansMetrics"

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

    def test_throughput_epm_day_rollup(self):
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_span_metric(
                    1,
                    internal_metric=constants.SELF_TIME_LIGHT,
                    timestamp=self.day_ago + timedelta(hours=hour, minutes=minute),
                )

        for axis in ["epm()", "spm()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=24)),
                    "interval": "24h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": "spansMetrics",
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 2
            assert response.data["meta"]["dataset"] == "spansMetrics"

            assert data[0][1][0]["count"] == sum(event_counts) / (86400.0 / 60.0)

    def test_throughput_epm_hour_rollup_offset_of_hour(self):
        # Each of these denotes how many events to create in each hour
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_span_metric(
                    1,
                    internal_metric=constants.SELF_TIME_LIGHT,
                    timestamp=self.day_ago + timedelta(hours=hour, minutes=minute + 30),
                )

        for axis in ["epm()", "spm()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago + timedelta(minutes=30)),
                    "end": iso_format(self.day_ago + timedelta(hours=6, minutes=30)),
                    "interval": "1h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": "spansMetrics",
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["meta"]["dataset"] == "spansMetrics"

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

    def test_throughput_eps_minute_rollup(self):
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        for minute, count in enumerate(event_counts):
            for second in range(count):
                self.store_transaction_metric(
                    1,
                    internal_metric=constants.SELF_TIME_LIGHT,
                    timestamp=self.day_ago + timedelta(minutes=minute, seconds=second),
                )

        for axis in ["eps()", "sps()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(minutes=6)),
                    "interval": "1m",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": "spansMetrics",
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["meta"]["dataset"] == "spansMetrics"

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / 60.0

    def test_top_events(self):
        # Each of these denotes how many events to create in each minute
        for transaction in ["foo", "bar"]:
            self.store_span_metric(
                2, timestamp=self.day_ago + timedelta(minutes=1), tags={"transaction": transaction}
            )
        self.store_span_metric(
            1, timestamp=self.day_ago + timedelta(minutes=1), tags={"transaction": "baz"}
        )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(minutes=6)),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "project": self.project.id,
                "dataset": "spansMetrics",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert "Other" in response.data
        assert "foo" in response.data
        assert "bar" in response.data
        assert response.data["Other"]["meta"]["dataset"] == "spansMetrics"

    def test_resource_encoded_length(self):
        self.store_span_metric(
            4,
            metric="http.response_content_length",
            timestamp=self.day_ago + timedelta(minutes=1),
            tags={"transaction": "foo"},
        )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(minutes=2)),
                "interval": "1m",
                "yAxis": "avg(http.response_content_length)",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "excludeOther": 0,
            },
        )

        assert response.status_code == 200

        data = response.data["data"]
        assert len(data) == 2
        assert not data[0][1][0]["count"]
        assert data[1][1][0]["count"] == 4.0

    def test_resource_decoded_length(self):
        self.store_span_metric(
            4,
            metric="http.decoded_response_content_length",
            timestamp=self.day_ago + timedelta(minutes=1),
            tags={"transaction": "foo"},
        )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(minutes=2)),
                "interval": "1m",
                "yAxis": "avg(http.decoded_response_content_length)",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "excludeOther": 0,
            },
        )

        data = response.data["data"]
        assert response.status_code == 200
        assert len(data) == 2
        assert not data[0][1][0]["count"]
        assert data[1][1][0]["count"] == 4.0

    def test_resource_transfer_size(self):
        self.store_span_metric(
            4,
            metric="http.response_transfer_size",
            timestamp=self.day_ago + timedelta(minutes=1),
            tags={"transaction": "foo"},
        )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(minutes=2)),
                "interval": "1m",
                "yAxis": "avg(http.response_transfer_size)",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "excludeOther": 0,
            },
        )

        data = response.data["data"]
        assert response.status_code == 200
        assert len(data) == 2
        assert not data[0][1][0]["count"]
        assert data[1][1][0]["count"] == 4.0


class OrganizationEventsStatsSpansMetricsEndpointTestWithMetricLayer(
    OrganizationEventsStatsSpansMetricsEndpointTest
):
    def setUp(self):
        super().setUp()
        self.features["organizations:use-metrics-layer"] = True

    @patch("sentry.snuba.metrics.datasource")
    def test_metrics_layer_is_not_used(self, get_series):
        self.store_span_metric(
            4,
            metric="http.response_content_length",
            timestamp=self.day_ago + timedelta(minutes=1),
            tags={"transaction": "foo"},
        )

        self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(minutes=2)),
                "interval": "1m",
                "yAxis": "avg(http.response_content_length)",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "excludeOther": 0,
            },
        )

        get_series.assert_not_called()
