from __future__ import annotations

import datetime
from datetime import timezone

import pytest
from snuba_sdk import Column, Condition, Function, Op

from sentry.exceptions import IncompatibleMetricsQuery
from sentry.search.events.builder.metrics import (
    MetricsQueryBuilder,
    TimeseriesMetricQueryBuilder,
)
from sentry.search.events.types import ParamsType, QueryBuilderConfig
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import TestCase

pytestmark = [pytest.mark.sentry_metrics]


class MetricBuilderBaseTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.start = datetime.datetime.now(tz=timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        ) - datetime.timedelta(days=18)
        self.end = datetime.datetime.now(tz=timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        self.projects = [self.project.id]
        self.params: ParamsType = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
            "start": self.start,
            "end": self.end,
        }


class MetricQueryBuilderTest(MetricBuilderBaseTest):
    def test_empty_environment_filter_resolves_to_integer_sentinel(self) -> None:
        # Integer-indexed metrics (release-health / alerts) store tag values in the
        # UInt64 `tags` column, so the "no environment" filter (`environment:""`)
        # must compare to the integer 0 -- comparing the UInt64 column to "" makes
        # ClickHouse fail converting '' to UInt64 and breaks crash-rate alert
        # subscriptions (SNUBA-B5T).
        query = MetricsQueryBuilder(
            self.params,
            query='environment:""',
            dataset=Dataset.Metrics,
            selected_columns=[],
            config=QueryBuilderConfig(skip_field_validation_for_entity_subscription_deletion=True),
        )
        assert not query.is_performance
        assert Condition(query.column("environment"), Op.EQ, 0) in query.where

    def test_limit_validation(self) -> None:
        # 51 is ok
        MetricsQueryBuilder(self.params, limit=51)
        # None is ok, defaults to 50
        query = MetricsQueryBuilder(self.params)
        assert query.limit is not None
        assert query.limit.limit == 50
        # anything higher should throw an error
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(self.params, limit=10_000)

    def test_granularity(self) -> None:
        # Need to pick granularity based on the period
        def get_granularity(start, end):
            params = {
                "organization_id": self.organization.id,
                "project_id": self.projects,
                "start": start,
                "end": end,
            }
            query = MetricsQueryBuilder(params)
            return query.granularity.granularity

        # If we're doing atleast day and its midnight we should use the daily bucket
        start = datetime.datetime(2015, 5, 18, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 0, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "A day at midnight"

        # If we're doing several days, allow more range
        start = datetime.datetime(2015, 5, 18, 0, 10, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 28, 23, 59, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "Several days"

        # We're doing a long period, use the biggest granularity
        start = datetime.datetime(2015, 5, 18, 12, 33, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 7, 28, 17, 22, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "Big range"

        # If we're on the start of the hour we should use the hour granularity
        start = datetime.datetime(2015, 5, 18, 23, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 20, 1, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "On the hour"

        # If we're close to the start of the hour we should use the hour granularity
        start = datetime.datetime(2015, 5, 18, 23, 3, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 21, 1, 57, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "On the hour, close"

        # A decently long period but not close to hour ends, still use hour bucket
        start = datetime.datetime(2015, 5, 18, 23, 3, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 28, 1, 57, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "On the hour, long period"

        # Hour to hour should only happen at the precise hour
        start = datetime.datetime(2015, 5, 18, 10, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 18, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "precisely hour to hour"

        # Even a few seconds means we need to switch back to minutes since the latter bucket may not be filled
        start = datetime.datetime(2015, 5, 18, 10, 0, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 18, 0, 1, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 60, "hour to hour but with seconds"

        # Even though this is >24h of data, because its a random hour in the middle of the day to the next we use minute
        # granularity
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 18, 15, 1, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 60, "A few hours, but random minute"

        # Less than a minute, no reason to work hard for such a small window, just use a minute
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 10, 15, 34, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 60, "less than a minute"

    def test_granularity_boundaries(self) -> None:
        # Need to pick granularity based on the period
        def get_granularity(start, end):
            params = {
                "organization_id": self.organization.id,
                "project_id": self.projects,
                "start": start,
                "end": end,
            }
            query = MetricsQueryBuilder(params)
            return query.granularity.granularity

        # See resolve_granularity on the MQB to see what these boundaries are

        # Exactly 30d, at the 30 minute boundary
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 31, 0, 30, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "30d at boundary"

        # Near 30d, but 1 hour before the boundary for end
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 30, 23, 29, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "near 30d, but 1 hour before boundary for end"

        # Near 30d, but 1 hour after the boundary for start
        start = datetime.datetime(2015, 5, 1, 1, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 31, 0, 30, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "near 30d, but 1 hour after boundary for start"

        # Exactly 3d
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 4, 0, 30, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "3d at boundary"

        # Near 3d, but 1 hour before the boundary for end
        start = datetime.datetime(2015, 5, 1, 0, 13, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 3, 23, 45, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "near 3d, but 1 hour before boundary for end"

        # Near 3d, but 1 hour after the boundary for start
        start = datetime.datetime(2015, 5, 1, 1, 46, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 4, 0, 46, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "near 3d, but 1 hour after boundary for start"

        # exactly 12 hours
        start = datetime.datetime(2015, 5, 1, 0, 15, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 1, 12, 15, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "12h at boundary"

        # Near 12h, but 15 minutes before the boundary for end
        start = datetime.datetime(2015, 5, 1, 0, 15, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 1, 12, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 60, (
            "12h at boundary, but 15 min before the boundary for end"
        )

        # Near 12h, but 15 minutes after the boundary for start
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 1, 12, 15, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 60, (
            "12h at boundary, but 15 min after the boundary for start"
        )

    # TODO: multiple groupby with counter

    def test_missing_function(self) -> None:
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(
                self.params,
                query="",
                selected_columns=[
                    "count_all_the_things_that_i_want()",
                    "transaction",
                ],
                groupby_columns=[
                    "transaction",
                ],
            )

    def test_free_text_search(self) -> None:
        query = MetricsQueryBuilder(
            self.params,
            dataset=None,
            query="foo",
            selected_columns=["count()"],
        )

        self.maxDiff = 100000

        transaction_key = indexer.resolve(
            UseCaseID.TRANSACTIONS, self.organization.id, "transaction"
        )
        self.assertCountEqual(
            query.where,
            [
                Condition(
                    Function(
                        "positionCaseInsensitive",
                        [
                            Column(f"tags[{transaction_key}]"),
                            "foo",
                        ],
                    ),
                    Op.NEQ,
                    0,
                ),
                Condition(
                    Column("metric_id"),
                    Op.IN,
                    [
                        indexer.resolve(
                            UseCaseID.TRANSACTIONS,
                            self.organization.id,
                            "d:transactions/duration@millisecond",
                        )
                    ],
                ),
                *self.default_conditions,
            ],
        )


class TimeseriesMetricQueryBuilderTest(MetricBuilderBaseTest):
    def test_granularity(self) -> None:
        # Need to pick granularity based on the period and interval for timeseries
        def get_granularity(start, end, interval):
            query = TimeseriesMetricQueryBuilder(
                {
                    "organization_id": self.organization.id,
                    "project_id": self.projects,
                    "start": start,
                    "end": end,
                },
                interval=interval,
            )
            return query.granularity.granularity

        # If we're doing atleast day and its midnight we should use the daily bucket
        start = datetime.datetime(2015, 5, 18, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 0, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end, 900) == 60, "A day at midnight, 15min interval"
        assert get_granularity(start, end, 3600) == 3600, "A day at midnight, 1hr interval"
        assert get_granularity(start, end, 86400) == 86400, "A day at midnight, 1d interval"

        # If we're on the start of the hour we should use the hour granularity
        start = datetime.datetime(2015, 5, 18, 23, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 20, 1, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end, 900) == 60, "On the hour, 15min interval"
        assert get_granularity(start, end, 3600) == 3600, "On the hour, 1hr interval"
        assert get_granularity(start, end, 86400) == 3600, "On the hour, 1d interval"

        # Even though this is >24h of data, because its a random hour in the middle of the day to the next we use minute
        # granularity
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 15, 15, 1, tzinfo=timezone.utc)
        assert get_granularity(start, end, 900) == 60, (
            "A few hours, but random minute, 15min interval"
        )
        assert get_granularity(start, end, 3600) == 3600, (
            "A few hours, but random minute, 1hr interval"
        )
        assert get_granularity(start, end, 86400) == 3600, (
            "A few hours, but random minute, 1d interval"
        )

        # Less than a minute, no reason to work hard for such a small window, just use a minute
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 10, 15, 34, tzinfo=timezone.utc)
        assert get_granularity(start, end, 900) == 60, "less than a minute, 15min interval"
        assert get_granularity(start, end, 3600) == 3600, "less than a minute, 1hr interval"
        assert get_granularity(start, end, 86400) == 3600, "less than a minute, 1d interval"
