from datetime import timedelta
from unittest import mock

import pytest
from django.urls import reverse

from sentry import options
from sentry.testutils import MetricsEnhancedPerformanceTestCase
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
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert [attrs for time, attrs in data] == [
            [{"count": 123}],
            [{"count": 0}],
        ]

    def test_search_query_if_environment_does_not_exist_on_indexer(self):
        if options.get("sentry-metrics.performance.tags-values-are-strings"):
            pytest.skip("test does not apply if tag values are in clickhouse")
        self.create_environment(self.project, name="prod")
        self.create_environment(self.project, name="dev")
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
                "yAxis": [
                    "sum(transaction.duration)",
                ],
                "environment": ["prod", "dev"],
                "dataset": "metricsEnhanced",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert [attrs for time, attrs in data] == [
            [{"count": 0}],
            [{"count": 0}],
        ]
        assert not response.data["isMetricsData"]

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
