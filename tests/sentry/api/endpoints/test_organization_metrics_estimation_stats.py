from datetime import timedelta
from random import choice
from typing import List, Optional, cast

import pytest
from django.utils import timezone

from sentry.api.endpoints.organization_metrics_estimation_stats import (
    CountResult,
    MetricVolumeRow,
    StatsQualityEstimation,
    _count_non_zero_intervals,
    _should_scale,
    estimate_stats_quality,
    estimate_volume,
)
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import APITestCase, BaseMetricsLayerTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)

SECOND = timedelta(seconds=1)
MINUTE = timedelta(minutes=1)

pytestmark = pytest.mark.sentry_metrics


@region_silo_test
@freeze_time(MOCK_DATETIME)
class OrganizationMetricsEstimationStatsEndpointTest(APITestCase, BaseMetricsLayerTestCase):
    endpoint = "sentry-api-0-organization-metrics-estimation-stats"
    method = "GET"

    @property
    def now(self):
        return MOCK_DATETIME

    def _get_id(self, length):
        return "".join([choice("abcde") for i in range(length)])

    def create_transaction(
        self,
        start_timestamp,
        duration,
    ):
        timestamp = start_timestamp + timedelta(milliseconds=duration)

        trace_id = self._get_id(32)
        span_id = self._get_id(16)

        data = load_data(
            "transaction",
            trace=trace_id,
            span_id=span_id,
            spans=None,
            start_timestamp=start_timestamp,
            timestamp=timestamp,
        )
        return self.store_event(data, project_id=self.project.id)

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        """
        Tests that the volume estimation endpoint correctly looks up the data in the Db and
        returns the correct volume.
        """
        # the number of transactions created in the last 3 minutes
        transactions_long = [0, 1, 2, 3]
        transactions_short = [1, 1, 1, 2]

        # the number of transaction metrics (regardless of the duration) recorde in the last 3 minutes
        # must be at least the number of tranactions created (if sample rate is 1)
        transaction_metrics = [2, 4, 8, 20]
        num_minutes = len(transactions_long)

        # create the transactions and the metrics in Snuba
        for idx in range(num_minutes):
            # put the transactions in the middle of the minute
            seconds_before = (num_minutes - idx - 1) * MINUTE + SECOND * 30
            # put the metric at the beginning of the minute (utility only takes minutes)
            minutes_before = num_minutes - idx - 1
            # short transactions
            for _ in range(transactions_short[idx]):
                self.create_transaction(self.now - seconds_before, 10)
            # long transactions
            for _ in range(transactions_long[idx]):
                self.create_transaction(self.now - seconds_before, 100)
            # transaction metrics
            for _ in range(transaction_metrics[idx]):
                self.store_performance_metric(
                    name=TransactionMRI.DURATION.value,
                    tags={"transaction": "t1"},
                    minutes_before_now=minutes_before,
                    value=3.14,
                    project_id=self.project.id,
                    org_id=self.organization.id,
                )

        # call the endpoint
        response = self.get_response(
            self.organization.slug,
            interval="1m",
            yAxis="count()",
            statsPeriod="4m",
            query="transaction.duration:>50 event.type:transaction",
        )

        assert response.status_code == 200, response.content

        timestamp = self.now.timestamp()
        data = response.data
        start = timestamp - 4 * 60
        assert data["start"] == start
        assert data["end"] == timestamp
        for idx in range(4):
            current_timestamp = start + idx * 60
            current = data["data"][idx]
            assert current[0] == current_timestamp
            count = current[1][0]["count"]

            if transactions_long[idx] == 0:
                # no indexed metrics for the query (we shouldn't have scaled anything)
                assert count == 0
            else:
                # we expect to get the indexed_result * base_metrics / base_indexed
                # base_indexed = transactions_long+transactions_short ( we can't distinguish between short and long
                # in basic query)
                # base_metrics = transaction_metrics
                # indexed_result = transactions_long ( we can't distinguish between short and long in indexed query)
                expected = (
                    transactions_long[idx]
                    * transaction_metrics[idx]
                    / (transactions_short[idx] + transactions_long[idx])
                )
                assert pytest.approx(count, 0.001) == expected

    def test_apdex(self):
        """
        Tests that the apdex calculation works as expected.

        This test adds some indexed data to the Db.
        Since apdex cannot be extrapolated only indexed data is used.
        """

        # --- Create test data ---

        # the number of transactions created in the last 3 minutes
        transactions_long = [1, 2, 3, 4]
        transactions_short = [2, 4, 5, 6]

        num_minutes = len(transactions_long)

        # create the transactions and the metrics in Snuba
        for idx in range(num_minutes):
            # put the transactions in the middle of the minute
            seconds_before = (num_minutes - idx - 1) * MINUTE + SECOND * 30
            # short transactions
            for _ in range(transactions_short[idx]):
                self.create_transaction(self.now - seconds_before, 10)
            # long transactions
            for _ in range(transactions_long[idx]):
                self.create_transaction(self.now - seconds_before, 100)

        # --- call the endpoint ---
        response = self.get_response(
            self.organization.slug,
            interval="1m",
            yAxis="apdex(50)",
            statsPeriod="4m",
            query="transaction.duration:>0.09 event.type:transaction",
        )

        assert response.status_code == 200, response.content

        def apdex(satisfactory, tolerable):
            return (satisfactory + 0.5 * tolerable) / (satisfactory + tolerable)

        # --- check the results ---
        timestamp = self.now.timestamp()
        data = response.data
        start = timestamp - 4 * 60
        assert data["start"] == start
        assert data["end"] == timestamp
        for idx in range(4):
            current_timestamp = start + idx * 60
            current = data["data"][idx]
            assert current[0] == current_timestamp
            actual = current[1][0]["count"]

            # calculate the expected apdex, short transactions are satisfactory,
            # long transactions are tolerable
            expected = apdex(transactions_short[idx], transactions_long[idx])
            assert pytest.approx(actual, 0.001) == expected


@pytest.mark.parametrize(
    "indexed, base_indexed, metrics, expected",
    [
        [[1, 2], [2, 4], [4, 8], [1 * 4 / 2, 2 * 8 / 4]],
        [[1], [4], [16], [1 * 16 / 4]],
        [[0], [4], [16], [0]],
        [[0, 1, 7], [8, 8, 8], [120, 120, 120], [0, 1 * 120 / 8, 7 * 120 / 8]],
    ],
)
def test_estimate_volume(indexed, base_indexed, metrics, expected):
    """
    Tests volume estimation calculation
    """
    # shape the data as it is returned by get_event_stats i.e. [[timestamp, [{"count": count]],...]
    indexed = [[idx + 1000, [{"count": val}]] for idx, val in enumerate(indexed)]
    base_indexed = [[idx + 1000, [{"count": val}]] for idx, val in enumerate(base_indexed)]
    metrics = [[idx + 1000, [{"count": val}]] for idx, val in enumerate(metrics)]

    actual = estimate_volume(indexed, base_indexed, metrics)

    for idx, val in enumerate(actual):
        count: Optional[float] = cast(List[CountResult], val[1])[0]["count"]
        assert pytest.approx(count, 0.001) == expected[idx]


@pytest.mark.parametrize(
    "metric, should_scale",
    [
        ("count()", True),
        ("p95(transaction.duration)", False),
        ("apdex(300)", False),
        ("failure_rate()", False),
        ("percentile(measurements.lcp,0.55)", False),  # Largest Contentful Paint
        ("p95(measurements.fid)", False),  # First Input Delay
        ("avg(measurements.cls)", False),  # First Input Delay
    ],
)
def test_should_scale(metric: str, should_scale: bool):
    """
    Tests the _should_scale function
    """
    assert _should_scale(metric) == should_scale


@pytest.mark.parametrize(
    "zero_samples, expected_result",
    [
        (10, StatsQualityEstimation.GOOD_INDEXED_DATA),
        (50, StatsQualityEstimation.ACCEPTABLE_INDEXED_DATA),
        (70, StatsQualityEstimation.POOR_INDEXED_DATA),
        (100, StatsQualityEstimation.NO_INDEXED_DATA),
    ],
)
def test_estimate_stats_quality(zero_samples, expected_result):
    num_samples = 100

    start_timestamp = 1_500_000_000

    one: CountResult = {"count": 1}
    zero: CountResult = {"count": 0}

    data = cast(
        List[MetricVolumeRow],
        [[start_timestamp + idx * 100, [zero]] for idx in range(zero_samples)]
        + [[start_timestamp + idx * 100, [one]] for idx in range(zero_samples, num_samples)],
    )

    assert estimate_stats_quality(data) == expected_result


@pytest.mark.parametrize("zero_samples", [0, 1, 5, 9, 10])
def test_count_non_zero_intervals(zero_samples):
    num_samples = 10

    start_timestamp = 1_500_000_000

    one: CountResult = {"count": 1}
    zero: CountResult = {"count": 0}

    data = cast(
        List[MetricVolumeRow],
        [[start_timestamp + idx * 100, [zero]] for idx in range(zero_samples)]
        + [[start_timestamp + idx * 100, [one]] for idx in range(zero_samples, num_samples)],
    )

    assert _count_non_zero_intervals(data) == num_samples - zero_samples
