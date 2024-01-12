from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest import mock

import pytest
from django.urls import reverse

from sentry.models.environment import Environment
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.extraction import MetricSpecType, OnDemandMetricSpec
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test

pytestmark = pytest.mark.sentry_metrics


@region_silo_test
class OrganizationEventsStatsMetricsEnhancedPerformanceEndpointTest(
    MetricsEnhancedPerformanceTestCase
):
    endpoint = "sentry-api-0-organization-events-stats"
    METRIC_STRINGS = [
        "foo_transaction",
        "d:transactions/measurements.datacenter_memory@pebibyte",
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

        self.additional_params = dict()

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
                self.store_transaction_metric(
                    1, timestamp=self.day_ago + timedelta(hours=hour, minutes=minute)
                )

        for axis in ["epm()", "tpm()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=6)),
                    "interval": "1h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": "metricsEnhanced",
                    **self.additional_params,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["isMetricsData"]

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

    def test_throughput_epm_day_rollup(self):
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_transaction_metric(
                    1, timestamp=self.day_ago + timedelta(hours=hour, minutes=minute)
                )

        for axis in ["epm()", "tpm()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=24)),
                    "interval": "24h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": "metricsEnhanced",
                    **self.additional_params,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 2
            assert response.data["isMetricsData"]

            assert data[0][1][0]["count"] == sum(event_counts) / (86400.0 / 60.0)

    def test_throughput_epm_hour_rollup_offset_of_hour(self):
        # Each of these denotes how many events to create in each hour
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_transaction_metric(
                    1, timestamp=self.day_ago + timedelta(hours=hour, minutes=minute + 30)
                )

        for axis in ["tpm()", "epm()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago + timedelta(minutes=30)),
                    "end": iso_format(self.day_ago + timedelta(hours=6, minutes=30)),
                    "interval": "1h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": "metricsEnhanced",
                    **self.additional_params,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["isMetricsData"]

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

    def test_throughput_eps_minute_rollup(self):
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        for minute, count in enumerate(event_counts):
            for second in range(count):
                self.store_transaction_metric(
                    1, timestamp=self.day_ago + timedelta(minutes=minute, seconds=second)
                )

        for axis in ["eps()", "tps()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(minutes=6)),
                    "interval": "1m",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": "metricsEnhanced",
                    **self.additional_params,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["isMetricsData"]

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / 60.0

    def test_failure_rate(self):
        for hour in range(6):
            timestamp = self.day_ago + timedelta(hours=hour, minutes=30)
            self.store_transaction_metric(1, tags={"transaction.status": "ok"}, timestamp=timestamp)
            if hour < 3:
                self.store_transaction_metric(
                    1, tags={"transaction.status": "internal_error"}, timestamp=timestamp
                )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=6)),
                "interval": "1h",
                "yAxis": ["failure_rate()"],
                "project": self.project.id,
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 6
        assert response.data["isMetricsData"]
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 0.5}],
            [{"count": 0.5}],
            [{"count": 0.5}],
            [{"count": 0}],
            [{"count": 0}],
            [{"count": 0}],
        ]

    def test_percentiles_multi_axis(self):
        for hour in range(6):
            timestamp = self.day_ago + timedelta(hours=hour, minutes=30)
            self.store_transaction_metric(111, timestamp=timestamp)
            self.store_transaction_metric(222, metric="measurements.lcp", timestamp=timestamp)

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=6)),
                "interval": "1h",
                "yAxis": ["p75(measurements.lcp)", "p75(transaction.duration)"],
                "project": self.project.id,
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )
        assert response.status_code == 200, response.content
        lcp = response.data["p75(measurements.lcp)"]
        duration = response.data["p75(transaction.duration)"]
        assert len(duration["data"]) == 6
        assert duration["isMetricsData"]
        assert len(lcp["data"]) == 6
        assert lcp["isMetricsData"]
        for item in duration["data"]:
            assert item[1][0]["count"] == 111
        for item in lcp["data"]:
            assert item[1][0]["count"] == 222

    @mock.patch("sentry.snuba.metrics_enhanced_performance.timeseries_query", return_value={})
    def test_multiple_yaxis_only_one_query(self, mock_query):
        self.do_request(
            data={
                "project": self.project.id,
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": ["epm()", "eps()", "tpm()", "p50(transaction.duration)"],
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )

        assert mock_query.call_count == 1

    def test_aggregate_function_user_count(self):
        self.store_transaction_metric(
            1, metric="user", timestamp=self.day_ago + timedelta(minutes=30)
        )
        self.store_transaction_metric(
            1, metric="user", timestamp=self.day_ago + timedelta(hours=1, minutes=30)
        )
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "count_unique(user)",
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["isMetricsData"]
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 1}]]
        meta = response.data["meta"]
        assert meta["isMetricsData"] == response.data["isMetricsData"]

    def test_non_mep_query_fallsback(self):
        def get_mep(query):
            response = self.do_request(
                data={
                    "project": self.project.id,
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "query": query,
                    "yAxis": ["epm()"],
                    "dataset": "metricsEnhanced",
                    **self.additional_params,
                },
            )
            assert response.status_code == 200, response.content
            return response.data["isMetricsData"]

        assert get_mep(""), "empty query"
        assert get_mep("event.type:transaction"), "event type transaction"
        assert not get_mep("event.type:error"), "event type error"
        assert not get_mep("transaction.duration:<15min"), "outlier filter"
        assert get_mep("epm():>0.01"), "throughput filter"
        assert not get_mep(
            "event.type:transaction OR event.type:error"
        ), "boolean with non-mep filter"
        assert get_mep(
            "event.type:transaction OR transaction:foo_transaction"
        ), "boolean with mep filter"

    def test_having_condition_with_preventing_aggregates(self):
        response = self.do_request(
            data={
                "project": self.project.id,
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "query": "p95():<5s",
                "yAxis": ["epm()"],
                "dataset": "metricsEnhanced",
                "preventMetricAggregates": "1",
                **self.additional_params,
            },
        )
        assert response.status_code == 200, response.content
        assert not response.data["isMetricsData"]
        meta = response.data["meta"]
        assert meta["isMetricsData"] == response.data["isMetricsData"]

    def test_explicit_not_mep(self):
        response = self.do_request(
            data={
                "project": self.project.id,
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                # Should be a mep able query
                "query": "",
                "yAxis": ["epm()"],
                "metricsEnhanced": "0",
                **self.additional_params,
            },
        )
        assert response.status_code == 200, response.content
        assert not response.data["isMetricsData"]
        meta = response.data["meta"]
        assert meta["isMetricsData"] == response.data["isMetricsData"]

    def test_sum_transaction_duration(self):
        self.store_transaction_metric(123, timestamp=self.day_ago + timedelta(minutes=30))
        self.store_transaction_metric(456, timestamp=self.day_ago + timedelta(hours=1, minutes=30))
        self.store_transaction_metric(789, timestamp=self.day_ago + timedelta(hours=1, minutes=30))
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "sum(transaction.duration)",
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["isMetricsData"]
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 123}],
            [{"count": 1245}],
        ]
        meta = response.data["meta"]
        assert meta["isMetricsData"] == response.data["isMetricsData"]
        assert meta["fields"] == {"time": "date", "sum_transaction_duration": "duration"}
        assert meta["units"] == {"time": None, "sum_transaction_duration": "millisecond"}

    def test_sum_transaction_duration_with_comparison(self):
        # We store the data for the previous day (in order to have values for the comparison).
        self.store_transaction_metric(
            1, timestamp=self.day_ago - timedelta(days=1) + timedelta(minutes=30)
        )
        self.store_transaction_metric(
            2, timestamp=self.day_ago - timedelta(days=1) + timedelta(minutes=30)
        )
        # We store the data for today.
        self.store_transaction_metric(123, timestamp=self.day_ago + timedelta(minutes=30))
        self.store_transaction_metric(456, timestamp=self.day_ago + timedelta(minutes=30))
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(days=1)),
                "interval": "1d",
                "yAxis": "sum(transaction.duration)",
                "comparisonDelta": 86400,
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["isMetricsData"]
        # For some reason, if all tests run, there is some shared state that makes this test have data in the second
        # time bucket, which is filled automatically by the zerofilling. In order to avoid this flaky failure, we will
        # only check that the first bucket contains the actual data.
        assert [attrs for time, attrs in response.data["data"]][0] == [
            {"comparisonCount": 3.0, "count": 579.0}
        ]
        meta = response.data["meta"]
        assert meta["isMetricsData"] == response.data["isMetricsData"]
        assert meta["fields"] == {"time": "date", "sum_transaction_duration": "duration"}
        assert meta["units"] == {"time": None, "sum_transaction_duration": "millisecond"}

    def test_custom_measurement(self):
        self.store_transaction_metric(
            123,
            metric="measurements.bytes_transfered",
            internal_metric="d:transactions/measurements.datacenter_memory@pebibyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.day_ago + timedelta(minutes=30),
        )
        self.store_transaction_metric(
            456,
            metric="measurements.bytes_transfered",
            internal_metric="d:transactions/measurements.datacenter_memory@pebibyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.day_ago + timedelta(hours=1, minutes=30),
        )
        self.store_transaction_metric(
            789,
            metric="measurements.bytes_transfered",
            internal_metric="d:transactions/measurements.datacenter_memory@pebibyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.day_ago + timedelta(hours=1, minutes=30),
        )
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "sum(measurements.datacenter_memory)",
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["isMetricsData"]
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 123}],
            [{"count": 1245}],
        ]
        meta = response.data["meta"]
        assert meta["isMetricsData"] == response.data["isMetricsData"]
        assert meta["fields"] == {"time": "date", "sum_measurements_datacenter_memory": "size"}
        assert meta["units"] == {"time": None, "sum_measurements_datacenter_memory": "pebibyte"}

    def test_does_not_fallback_if_custom_metric_is_out_of_request_time_range(self):
        self.store_transaction_metric(
            123,
            timestamp=self.day_ago + timedelta(hours=1),
            internal_metric="d:transactions/measurements.custom@kibibyte",
            entity="metrics_distributions",
        )
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "p99(measurements.custom)",
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )
        meta = response.data["meta"]
        assert response.status_code == 200, response.content
        assert response.data["isMetricsData"]
        assert meta["isMetricsData"]
        assert meta["fields"] == {"time": "date", "p99_measurements_custom": "size"}
        assert meta["units"] == {"time": None, "p99_measurements_custom": "kibibyte"}

    def test_multi_yaxis_custom_measurement(self):
        self.store_transaction_metric(
            123,
            metric="measurements.bytes_transfered",
            internal_metric="d:transactions/measurements.datacenter_memory@pebibyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.day_ago + timedelta(minutes=30),
        )
        self.store_transaction_metric(
            456,
            metric="measurements.bytes_transfered",
            internal_metric="d:transactions/measurements.datacenter_memory@pebibyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.day_ago + timedelta(hours=1, minutes=30),
        )
        self.store_transaction_metric(
            789,
            metric="measurements.bytes_transfered",
            internal_metric="d:transactions/measurements.datacenter_memory@pebibyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.day_ago + timedelta(hours=1, minutes=30),
        )
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": [
                    "sum(measurements.datacenter_memory)",
                    "p50(measurements.datacenter_memory)",
                ],
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )
        assert response.status_code == 200, response.content
        sum_data = response.data["sum(measurements.datacenter_memory)"]
        p50_data = response.data["p50(measurements.datacenter_memory)"]
        assert sum_data["isMetricsData"]
        assert p50_data["isMetricsData"]
        assert [attrs for time, attrs in sum_data["data"]] == [
            [{"count": 123}],
            [{"count": 1245}],
        ]
        assert [attrs for time, attrs in p50_data["data"]] == [
            [{"count": 123}],
            [{"count": 622.5}],
        ]

        sum_meta = sum_data["meta"]
        assert sum_meta["isMetricsData"] == sum_data["isMetricsData"]
        assert sum_meta["fields"] == {
            "time": "date",
            "sum_measurements_datacenter_memory": "size",
            "p50_measurements_datacenter_memory": "size",
        }
        assert sum_meta["units"] == {
            "time": None,
            "sum_measurements_datacenter_memory": "pebibyte",
            "p50_measurements_datacenter_memory": "pebibyte",
        }

        p50_meta = p50_data["meta"]
        assert p50_meta["isMetricsData"] == p50_data["isMetricsData"]
        assert p50_meta["fields"] == {
            "time": "date",
            "sum_measurements_datacenter_memory": "size",
            "p50_measurements_datacenter_memory": "size",
        }
        assert p50_meta["units"] == {
            "time": None,
            "sum_measurements_datacenter_memory": "pebibyte",
            "p50_measurements_datacenter_memory": "pebibyte",
        }

    def test_dataset_metrics_does_not_fallback(self):
        self.store_transaction_metric(123, timestamp=self.day_ago + timedelta(minutes=30))
        self.store_transaction_metric(456, timestamp=self.day_ago + timedelta(hours=1, minutes=30))
        self.store_transaction_metric(789, timestamp=self.day_ago + timedelta(hours=1, minutes=30))
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "query": "transaction.duration:<5s",
                "yAxis": "sum(transaction.duration)",
                "dataset": "metrics",
                **self.additional_params,
            },
        )
        assert response.status_code == 400, response.content

    def test_title_filter(self):
        self.store_transaction_metric(
            123,
            tags={"transaction": "foo_transaction"},
            timestamp=self.day_ago + timedelta(minutes=30),
        )
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "query": "title:foo_transaction",
                "yAxis": [
                    "sum(transaction.duration)",
                ],
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert [attrs for time, attrs in data] == [
            [{"count": 123}],
            [{"count": 0}],
        ]

    def test_transaction_status_unknown_error(self):
        self.store_transaction_metric(
            123,
            tags={"transaction.status": "unknown"},
            timestamp=self.day_ago + timedelta(minutes=30),
        )
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "query": "transaction.status:unknown_error",
                "yAxis": [
                    "sum(transaction.duration)",
                ],
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert [attrs for time, attrs in data] == [
            [{"count": 123}],
            [{"count": 0}],
        ]

    def test_custom_performance_metric_meta_contains_field_and_unit_data(self):
        self.store_transaction_metric(
            123,
            timestamp=self.day_ago + timedelta(hours=1),
            internal_metric="d:transactions/measurements.custom@kibibyte",
            entity="metrics_distributions",
        )
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "p99(measurements.custom)",
                "query": "",
                **self.additional_params,
            },
        )

        assert response.status_code == 200
        meta = response.data["meta"]
        assert meta["fields"] == {"time": "date", "p99_measurements_custom": "size"}
        assert meta["units"] == {"time": None, "p99_measurements_custom": "kibibyte"}

    def test_multi_series_custom_performance_metric_meta_contains_field_and_unit_data(self):
        self.store_transaction_metric(
            123,
            timestamp=self.day_ago + timedelta(hours=1),
            internal_metric="d:transactions/measurements.custom@kibibyte",
            entity="metrics_distributions",
        )
        self.store_transaction_metric(
            123,
            timestamp=self.day_ago + timedelta(hours=1),
            internal_metric="d:transactions/measurements.another.custom@pebibyte",
            entity="metrics_distributions",
        )
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": [
                    "p95(measurements.custom)",
                    "p99(measurements.custom)",
                    "p99(measurements.another.custom)",
                ],
                "query": "",
                **self.additional_params,
            },
        )

        assert response.status_code == 200
        meta = response.data["p95(measurements.custom)"]["meta"]
        assert meta["fields"] == {
            "time": "date",
            "p95_measurements_custom": "size",
            "p99_measurements_custom": "size",
            "p99_measurements_another_custom": "size",
        }
        assert meta["units"] == {
            "time": None,
            "p95_measurements_custom": "kibibyte",
            "p99_measurements_custom": "kibibyte",
            "p99_measurements_another_custom": "pebibyte",
        }
        assert meta == response.data["p99(measurements.custom)"]["meta"]
        assert meta == response.data["p99(measurements.another.custom)"]["meta"]

    def test_no_top_events_with_project_field(self):
        project = self.create_project()
        response = self.do_request(
            data={
                # make sure to query the project with 0 events
                "project": project.id,
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "count()",
                "orderby": ["-count()"],
                "field": ["count()", "project"],
                "topEvents": 5,
                "dataset": "metrics",
                **self.additional_params,
            },
        )

        assert response.status_code == 200, response.content
        # When there are no top events, we do not return an empty dict.
        # Instead, we return a single zero-filled series for an empty graph.
        data = response.data["data"]
        assert [attrs for time, attrs in data] == [[{"count": 0}], [{"count": 0}]]

    def test_top_events_with_transaction(self):
        transaction_spec = [("foo", 100), ("bar", 200), ("baz", 300)]
        for offset in range(5):
            for transaction, duration in transaction_spec:
                self.store_transaction_metric(
                    duration,
                    tags={"transaction": f"{transaction}_transaction"},
                    timestamp=self.day_ago + timedelta(hours=offset, minutes=30),
                )

        response = self.do_request(
            data={
                # make sure to query the project with 0 events
                "project": self.project.id,
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=5)),
                "interval": "1h",
                "yAxis": "p75(transaction.duration)",
                "orderby": ["-p75(transaction.duration)"],
                "field": ["p75(transaction.duration)", "transaction"],
                "topEvents": 5,
                "dataset": "metrics",
                **self.additional_params,
            },
        )

        assert response.status_code == 200, response.content
        for position, (transaction, duration) in enumerate(transaction_spec):
            data = response.data[f"{transaction}_transaction"]
            chart_data = data["data"]
            assert data["order"] == 2 - position
            assert [attrs for time, attrs in chart_data] == [[{"count": duration}]] * 5


class OrganizationEventsStatsMetricsEnhancedPerformanceEndpointTestWithMetricLayer(
    OrganizationEventsStatsMetricsEnhancedPerformanceEndpointTest
):
    def setUp(self):
        super().setUp()
        self.features["organizations:use-metrics-layer"] = True
        self.additional_params = {"forceMetricsLayer": "true"}

    def test_counter_standard_metric(self):
        mri = "c:transactions/usage@none"
        for index, value in enumerate((10, 20, 30, 40, 50, 60)):
            self.store_transaction_metric(
                value,
                metric=mri,
                internal_metric=mri,
                entity="metrics_counters",
                timestamp=self.day_ago + timedelta(minutes=index),
                use_case_id=UseCaseID.CUSTOM,
            )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=6)),
                "interval": "1m",
                "yAxis": [f"sum({mri})"],
                "project": self.project.id,
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        for (_, value), expected_value in zip(data, [10, 20, 30, 40, 50, 60]):
            assert value[0]["count"] == expected_value  # type:ignore

    def test_counter_custom_metric(self):
        mri = "c:custom/sentry.process_profile.track_outcome@second"
        for index, value in enumerate((10, 20, 30, 40, 50, 60)):
            self.store_transaction_metric(
                value,
                metric=mri,
                internal_metric=mri,
                entity="metrics_counters",
                timestamp=self.day_ago + timedelta(hours=index),
                use_case_id=UseCaseID.CUSTOM,
            )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=6)),
                "interval": "1h",
                "yAxis": [f"sum({mri})"],
                "project": self.project.id,
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        for (_, value), expected_value in zip(data, [10, 20, 30, 40, 50, 60]):
            assert value[0]["count"] == expected_value  # type:ignore

    def test_distribution_custom_metric(self):
        mri = "d:custom/sentry.process_profile.track_outcome@second"
        for index, value in enumerate((10, 20, 30, 40, 50, 60)):
            for multiplier in (1, 2, 3):
                self.store_transaction_metric(
                    value * multiplier,
                    metric=mri,
                    internal_metric=mri,
                    entity="metrics_distributions",
                    timestamp=self.day_ago + timedelta(hours=index),
                    use_case_id=UseCaseID.CUSTOM,
                )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=6)),
                "interval": "1h",
                "yAxis": [f"min({mri})", f"max({mri})", f"p90({mri})"],
                "project": self.project.id,
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )

        assert response.status_code == 200, response.content
        data = response.data
        min = data[f"min({mri})"]["data"]
        for (_, value), expected_value in zip(min, [10.0, 20.0, 30.0, 40.0, 50.0, 60.0]):
            assert value[0]["count"] == expected_value  # type:ignore

        max = data[f"max({mri})"]["data"]
        for (_, value), expected_value in zip(max, [30.0, 60.0, 90.0, 120.0, 150.0, 180.0]):
            assert value[0]["count"] == expected_value  # type:ignore

        p90 = data[f"p90({mri})"]["data"]
        for (_, value), expected_value in zip(p90, [28.0, 56.0, 84.0, 112.0, 140.0, 168.0]):
            assert value[0]["count"] == expected_value  # type:ignore

    def test_set_custom_metric(self):
        mri = "s:custom/sentry.process_profile.track_outcome@second"
        for index, value in enumerate((10, 20, 30, 40, 50, 60)):
            # We store each value a second time, since we want to check the de-duplication of sets.
            for i in range(0, 2):
                self.store_transaction_metric(
                    value,
                    metric=mri,
                    internal_metric=mri,
                    entity="metrics_sets",
                    timestamp=self.day_ago + timedelta(hours=index),
                    use_case_id=UseCaseID.CUSTOM,
                )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=6)),
                "interval": "1h",
                "yAxis": [f"count_unique({mri})"],
                "project": self.project.id,
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        for (_, value), expected_value in zip(data, [1, 1, 1, 1, 1, 1]):
            assert value[0]["count"] == expected_value  # type:ignore

    def test_gauge_custom_metric(self):
        mri = "g:custom/sentry.process_profile.track_outcome@second"
        for index, value in enumerate((10, 20, 30, 40, 50, 60)):
            for multiplier in (1, 3):
                self.store_transaction_metric(
                    value * multiplier,
                    metric=mri,
                    internal_metric=mri,
                    entity="metrics_gauges",
                    # When multiple gauges are merged, in order to make the `last` merge work deterministically it's
                    # better to have the gauges with different timestamps so that the last value is always the same.
                    timestamp=self.day_ago + timedelta(hours=index, minutes=multiplier),
                    use_case_id=UseCaseID.CUSTOM,
                )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=6)),
                "interval": "1h",
                "yAxis": [
                    f"min({mri})",
                    f"max({mri})",
                    f"last({mri})",
                    f"sum({mri})",
                    f"count({mri})",
                ],
                "project": self.project.id,
                "dataset": "metricsEnhanced",
                **self.additional_params,
            },
        )

        assert response.status_code == 200, response.content
        data = response.data
        min = data[f"min({mri})"]["data"]
        for (_, value), expected_value in zip(min, [10.0, 20.0, 30.0, 40.0, 50.0, 60.0]):
            assert value[0]["count"] == expected_value  # type:ignore

        max = data[f"max({mri})"]["data"]
        for (_, value), expected_value in zip(max, [30.0, 60.0, 90.0, 120.0, 150.0, 180.0]):
            assert value[0]["count"] == expected_value  # type:ignore

        last = data[f"last({mri})"]["data"]
        for (_, value), expected_value in zip(last, [30.0, 60.0, 90.0, 120.0, 150.0, 180.0]):
            assert value[0]["count"] == expected_value  # type:ignore

        sum = data[f"sum({mri})"]["data"]
        for (_, value), expected_value in zip(sum, [40.0, 80.0, 120.0, 160.0, 200.0, 240.0]):
            assert value[0]["count"] == expected_value  # type:ignore

        count = data[f"count({mri})"]["data"]
        for (_, value), expected_value in zip(count, [40, 80, 120, 160, 200, 240]):
            assert value[0]["count"] == expected_value  # type:ignore


@region_silo_test
class OrganizationEventsStatsMetricsEnhancedPerformanceEndpointTestWithOnDemandWidgets(
    MetricsEnhancedPerformanceTestCase
):
    endpoint = "sentry-api-0-organization-events-stats"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.DEFAULT_METRIC_TIMESTAMP = self.day_ago
        Environment.get_or_create(self.project, "production")

        self.url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        self.features = {"organizations:on-demand-metrics-extraction-widgets": True}

    def do_request(self, data, url=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_top_events_wrong_on_demand_type(self):
        query = "transaction.duration:>=100"
        yAxis = ["count()", "count_web_vitals(measurements.lcp, good)"]
        response = self.do_request(
            data={
                "project": self.project.id,
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "orderby": ["-count()"],
                "environment": "production",
                "query": query,
                "yAxis": yAxis,
                "field": [
                    "count()",
                ],
                "topEvents": 5,
                "dataset": "metrics",
                "useOnDemandMetrics": "true",
                "onDemandType": "not_real",
            },
        )

        assert response.status_code == 400, response.content

    def test_top_events_works_without_on_demand_type(self):
        query = "transaction.duration:>=100"
        yAxis = ["count()", "count_web_vitals(measurements.lcp, good)"]
        response = self.do_request(
            data={
                "project": self.project.id,
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "orderby": ["-count()"],
                "environment": "production",
                "query": query,
                "yAxis": yAxis,
                "field": [
                    "count()",
                ],
                "topEvents": 5,
                "dataset": "metrics",
                "useOnDemandMetrics": "true",
            },
        )

        assert response.status_code == 200, response.content

    def test_top_events_with_transaction_on_demand(self):
        field = "count()"
        field_two = "count_web_vitals(measurements.lcp, good)"
        groupbys = ["customtag1", "customtag2"]
        query = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(
            field=field, groupbys=groupbys, query=query, spec_type=MetricSpecType.DYNAMIC_QUERY
        )
        spec_two = OnDemandMetricSpec(
            field=field_two, groupbys=groupbys, query=query, spec_type=MetricSpecType.DYNAMIC_QUERY
        )

        for hour in range(0, 5):
            self.store_on_demand_metric(
                hour * 62 * 24,
                spec=spec,
                additional_tags={
                    "customtag1": "foo",
                    "customtag2": "red",
                    "environment": "production",
                },
                timestamp=self.day_ago + timedelta(hours=hour),
            )
            self.store_on_demand_metric(
                hour * 60 * 24,
                spec=spec_two,
                additional_tags={
                    "customtag1": "bar",
                    "customtag2": "blue",
                    "environment": "production",
                },
                timestamp=self.day_ago + timedelta(hours=hour),
            )

        yAxis = ["count()", "count_web_vitals(measurements.lcp, good)"]

        response = self.do_request(
            data={
                "project": self.project.id,
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "orderby": ["-count()"],
                "environment": "production",
                "query": query,
                "yAxis": yAxis,
                "field": [
                    "count()",
                    "count_web_vitals(measurements.lcp, good)",
                    "customtag1",
                    "customtag2",
                ],
                "topEvents": 5,
                "dataset": "metricsEnhanced",
                "useOnDemandMetrics": "true",
                "onDemandType": "dynamic_query",
            },
        )

        assert response.status_code == 200, response.content

        groups = [
            ("foo,red", "count()", 0.0, 1488.0),
            ("foo,red", "count_web_vitals(measurements.lcp, good)", 0.0, 0.0),
            ("bar,blue", "count()", 0.0, 0.0),
            ("bar,blue", "count_web_vitals(measurements.lcp, good)", 0.0, 1440.0),
        ]
        assert len(response.data.keys()) == 2
        for group_count in groups:
            group, agg, row1, row2 = group_count
            row_data = response.data[group][agg]["data"][:2]
            assert [attrs for _, attrs in row_data] == [[{"count": row1}], [{"count": row2}]]

            assert response.data[group][agg]["meta"]["isMetricsExtractedData"]
            assert response.data[group]["isMetricsExtractedData"]

    def test_top_events_with_transaction_on_demand_and_no_environment(self):
        field = "count()"
        field_two = "count_web_vitals(measurements.lcp, good)"
        groupbys = ["customtag1", "customtag2"]
        query = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(
            field=field, groupbys=groupbys, query=query, spec_type=MetricSpecType.DYNAMIC_QUERY
        )
        spec_two = OnDemandMetricSpec(
            field=field_two, groupbys=groupbys, query=query, spec_type=MetricSpecType.DYNAMIC_QUERY
        )

        for hour in range(0, 5):
            self.store_on_demand_metric(
                hour * 62 * 24,
                spec=spec,
                additional_tags={
                    "customtag1": "foo",
                    "customtag2": "red",
                    "environment": "production",
                },
                timestamp=self.day_ago + timedelta(hours=hour),
            )
            self.store_on_demand_metric(
                hour * 60 * 24,
                spec=spec_two,
                additional_tags={
                    "customtag1": "bar",
                    "customtag2": "blue",
                    "environment": "production",
                },
                timestamp=self.day_ago + timedelta(hours=hour),
            )

        yAxis = ["count()", "count_web_vitals(measurements.lcp, good)"]

        response = self.do_request(
            data={
                "project": self.project.id,
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "orderby": ["-count()"],
                "query": query,
                "yAxis": yAxis,
                "field": [
                    "count()",
                    "count_web_vitals(measurements.lcp, good)",
                    "customtag1",
                    "customtag2",
                ],
                "topEvents": 5,
                "dataset": "metricsEnhanced",
                "useOnDemandMetrics": "true",
                "onDemandType": "dynamic_query",
            },
        )

        assert response.status_code == 200, response.content

        groups = [
            ("foo,red", "count()", 0.0, 1488.0),
            ("foo,red", "count_web_vitals(measurements.lcp, good)", 0.0, 0.0),
            ("bar,blue", "count()", 0.0, 0.0),
            ("bar,blue", "count_web_vitals(measurements.lcp, good)", 0.0, 1440.0),
        ]
        assert len(response.data.keys()) == 2
        for group_count in groups:
            group, agg, row1, row2 = group_count
            row_data = response.data[group][agg]["data"][:2]
            assert [attrs for time, attrs in row_data] == [[{"count": row1}], [{"count": row2}]]

            assert response.data[group][agg]["meta"]["isMetricsExtractedData"]
            assert response.data[group]["isMetricsExtractedData"]

    def test_timeseries_on_demand_with_multiple_percentiles(self):
        field = "p75(measurements.fcp)"
        field_two = "p75(measurements.lcp)"
        query = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(field=field, query=query, spec_type=MetricSpecType.DYNAMIC_QUERY)
        spec_two = OnDemandMetricSpec(
            field=field_two, query=query, spec_type=MetricSpecType.DYNAMIC_QUERY
        )

        assert (
            spec._query_str_for_hash
            == "event.measurements.fcp.value;{'name': 'event.duration', 'op': 'gte', 'value': 100.0}"
        )
        assert (
            spec_two._query_str_for_hash
            == "event.measurements.lcp.value;{'name': 'event.duration', 'op': 'gte', 'value': 100.0}"
        )

        for count in range(0, 4):
            self.store_on_demand_metric(
                count * 100,
                spec=spec,
                timestamp=self.day_ago + timedelta(hours=1),
            )
            self.store_on_demand_metric(
                count * 200.0,
                spec=spec_two,
                timestamp=self.day_ago + timedelta(hours=1),
            )

        yAxis = [field, field_two]

        response = self.do_request(
            data={
                "project": self.project.id,
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "orderby": [field],
                "query": query,
                "yAxis": yAxis,
                "dataset": "metricsEnhanced",
                "useOnDemandMetrics": "true",
                "onDemandType": "dynamic_query",
            },
        )

        assert response.status_code == 200, response.content

        assert response.data["p75(measurements.fcp)"]["meta"]["isMetricsExtractedData"]
        assert response.data["p75(measurements.lcp)"]["meta"]["isMetricsData"]
        assert [attrs for time, attrs in response.data["p75(measurements.fcp)"]["data"]] == [
            [{"count": 0}],
            [{"count": 225.0}],
        ]
        assert response.data["p75(measurements.lcp)"]["meta"]["isMetricsExtractedData"]
        assert response.data["p75(measurements.lcp)"]["meta"]["isMetricsData"]
        assert [attrs for time, attrs in response.data["p75(measurements.lcp)"]["data"]] == [
            [{"count": 0}],
            [{"count": 450.0}],
        ]

    def test_apdex_issue(self):
        field = "apdex(300)"
        groupbys = ["group_tag"]
        query = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(
            field=field,
            groupbys=groupbys,
            query=query,
            spec_type=MetricSpecType.DYNAMIC_QUERY,
        )

        for hour in range(0, 5):
            self.store_on_demand_metric(
                1,
                spec=spec,
                additional_tags={
                    "group_tag": "group_one",
                    "environment": "production",
                    "satisfaction": "tolerable",
                },
                timestamp=self.day_ago + timedelta(hours=hour),
            )
            self.store_on_demand_metric(
                1,
                spec=spec,
                additional_tags={
                    "group_tag": "group_two",
                    "environment": "production",
                    "satisfaction": "satisfactory",
                },
                timestamp=self.day_ago + timedelta(hours=hour),
            )

        response = self.do_request(
            data={
                "dataset": "metricsEnhanced",
                "environment": "production",
                "excludeOther": 1,
                "field": [field, "group_tag"],
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "orderby": f"-{field}",
                "partial": 1,
                "project": self.project.id,
                "query": query,
                "topEvents": 5,
                "yAxis": field,
                "onDemandType": "dynamic_query",
                "useOnDemandMetrics": "true",
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["group_one"]["meta"]["isMetricsExtractedData"] is True
        assert [attrs for time, attrs in response.data["group_one"]["data"]] == [
            [{"count": 0.5}],
            [{"count": 0.5}],
        ]

    def test_glob_http_referer_on_demand(self):
        agg = "count()"
        network_id_tag = "networkId"
        url = "https://sentry.io"
        query = f'http.url:{url}/*/foo/bar/* http.referer:"{url}/*/bar/*" event.type:transaction'
        spec = OnDemandMetricSpec(
            field=agg,
            groupbys=[network_id_tag],
            query=query,
            spec_type=MetricSpecType.DYNAMIC_QUERY,
        )
        assert spec.to_metric_spec(self.project) == {
            "category": "transaction",
            "mri": "c:transactions/on_demand@none",
            "field": None,
            "tags": [
                {"key": "query_hash", "value": "ac241f56"},
                {"key": "networkId", "field": "event.tags.networkId"},
                {"key": "environment", "field": "event.environment"},
            ],
            "condition": {
                "op": "and",
                "inner": [
                    {
                        "op": "glob",
                        "name": "event.request.url",
                        "value": ["https://sentry.io/*/foo/bar/*"],
                    },
                    {
                        "op": "glob",
                        "name": "event.request.headers.Referer",
                        "value": ["https://sentry.io/*/bar/*"],
                    },
                ],
            },
        }

        for hour in range(0, 5):
            self.store_on_demand_metric(
                1,
                spec=spec,
                additional_tags={network_id_tag: "1234"},
                timestamp=self.day_ago + timedelta(hours=hour),
            )
            self.store_on_demand_metric(
                1,
                spec=spec,
                additional_tags={network_id_tag: "5678"},
                timestamp=self.day_ago + timedelta(hours=hour),
            )

        response = self.do_request(
            data={
                "dataset": "metricsEnhanced",
                "field": [network_id_tag, agg],
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=5)),
                "onDemandType": "dynamic_query",
                "orderby": f"-{agg}",
                "interval": "1d",
                "partial": 1,
                "query": query,
                "referrer": "api.dashboards.widget.bar-chart",
                "project": self.project.id,
                "topEvents": 2,
                "useOnDemandMetrics": "true",
                "yAxis": agg,
            },
        )

        assert response.status_code == 200, response.content
        for datum in response.data.values():
            assert datum["meta"] == {
                "dataset": "metricsEnhanced",
                "datasetReason": "unchanged",
                "fields": {},
                "isMetricsData": False,
                "isMetricsExtractedData": True,
                "tips": {},
                "units": {},
            }

    def _test_is_metrics_extracted_data(
        self, params: dict[str, Any], expected_on_demand_query: bool, dataset: str
    ) -> None:
        features = {"organizations:on-demand-metrics-extraction": True}
        spec = OnDemandMetricSpec(
            field="count()",
            query="transaction.duration:>1s",
            spec_type=MetricSpecType.DYNAMIC_QUERY,
        )

        self.store_on_demand_metric(1, spec=spec)
        response = self.do_request(params, features=features)

        assert response.status_code == 200, response.content
        meta = response.data["meta"]
        # This is the main thing we want to test for
        assert meta.get("isMetricsExtractedData", False) is expected_on_demand_query
        assert meta["dataset"] == dataset

        return meta

    def test_is_metrics_extracted_data_is_included(self):
        self._test_is_metrics_extracted_data(
            {
                "dataset": "metricsEnhanced",
                "query": "transaction.duration:>=91",
                "useOnDemandMetrics": "true",
                "yAxis": "count()",
            },
            expected_on_demand_query=True,
            dataset="metricsEnhanced",
        )

    def test_group_by_transaction(self):
        field = "count()"
        groupbys = ["transaction"]
        query = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(
            field=field,
            groupbys=groupbys,
            query=query,
            spec_type=MetricSpecType.DYNAMIC_QUERY,
        )

        for hour in range(0, 2):
            self.store_on_demand_metric(
                (hour + 1) * 5,
                spec=spec,
                additional_tags={
                    "transaction": "/performance",
                    "environment": "production",
                },
                timestamp=self.day_ago + timedelta(hours=hour),
            )

        response = self.do_request(
            data={
                "dataset": "metricsEnhanced",
                "environment": "production",
                "excludeOther": 1,
                "field": [field, "transaction"],
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "orderby": f"-{field}",
                "partial": 1,
                "project": self.project.id,
                "query": query,
                "topEvents": 5,
                "yAxis": field,
                "onDemandType": "dynamic_query",
                "useOnDemandMetrics": "true",
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["/performance"]["meta"]["isMetricsExtractedData"] is True
        assert [attrs for time, attrs in response.data["/performance"]["data"]] == [
            [{"count": 5.0}],
            [{"count": 10.0}],
        ]
