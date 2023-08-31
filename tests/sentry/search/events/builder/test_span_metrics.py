import datetime
from datetime import timezone

import pytest
from snuba_sdk import And, Column, Condition, Op, Or

from sentry.search.events.builder import (
    SpansMetricsQueryBuilder,
    TimeseriesSpansMetricsQueryBuilder,
)
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase

pytestmark = pytest.mark.sentry_metrics


def create_condition(left_boundary, right_boundary, base_granularity, core_granularity):
    timestamp = Column("timestamp")
    granularity = Column("granularity")
    return [
        Or(
            [
                And(
                    [
                        Or(
                            [
                                Condition(timestamp, Op.GTE, right_boundary),
                                Condition(timestamp, Op.LT, left_boundary),
                            ]
                        ),
                        Condition(granularity, Op.EQ, base_granularity),
                    ]
                ),
                And(
                    [
                        Condition(timestamp, Op.GTE, left_boundary),
                        Condition(timestamp, Op.LT, right_boundary),
                        Condition(granularity, Op.EQ, core_granularity),
                    ]
                ),
            ]
        )
    ]


class MetricQueryBuilderTest(MetricsEnhancedPerformanceTestCase):
    def test_granularity(self):
        # Need to pick granularity based on the period
        def get_granularity(start, end):
            params = {
                "organization_id": self.organization.id,
                "project_id": [self.project.id],
                "start": start,
                "end": end,
            }
            query = SpansMetricsQueryBuilder(params)
            return query.resolve_split_granularity()

        # If we're doing atleast day and its midnight we should use the daily bucket, no granularity splitting happens
        start = datetime.datetime(2015, 5, 18, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 0, 0, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity.granularity == 86400, "Granularity at a day at midnight"
        assert condition == [], "Condition at a day at midnight"

        # If we're doing several days, allow more range
        start = datetime.datetime(2015, 5, 18, 0, 10, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 28, 23, 59, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity.granularity == 86400, "Granularity at Several days"
        assert condition == [], "Condition at Several days"

        # We're doing a long period, use the biggest granularity
        start = datetime.datetime(2015, 5, 18, 12, 33, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 7, 28, 17, 22, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity.granularity == 86400, "Granularity at Big Range"
        assert condition == [], "Condition at Big Range"

        # If we're on the start of the hour we should use the hour granularity
        start = datetime.datetime(2015, 5, 18, 23, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 20, 1, 0, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity is None, "Granularity on the hour"
        assert condition == create_condition(
            datetime.datetime(2015, 5, 19), datetime.datetime(2015, 5, 20), 3600, 86400
        ), "Condition, on the hour"

        # If we're close to the start of the hour we should use the hour granularity
        start = datetime.datetime(2015, 5, 18, 23, 3, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 21, 1, 57, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity is None, "Granularity on the hour, close"
        assert condition == create_condition(
            datetime.datetime(2015, 5, 19), datetime.datetime(2015, 5, 21), 3600, 86400
        ), "Condition on the hour, close"

        # A decently long period but not close to hour ends, still use hour bucket
        start = datetime.datetime(2015, 5, 18, 23, 3, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 28, 1, 57, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity is None, "Granularity on the hour, long period"
        assert condition == create_condition(
            datetime.datetime(2015, 5, 19), datetime.datetime(2015, 5, 28), 3600, 86400
        ), "Condition on the hour, long period"

        # Hour to hour should only happen at the precise hour
        start = datetime.datetime(2015, 5, 18, 10, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 18, 0, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity.granularity, "Granularity precisely hour to hour"
        assert condition == [], "Condition precisely hour to hour"

        # Even a few seconds means we need to switch back to minutes since the latter bucket may not be filled
        start = datetime.datetime(2015, 5, 18, 10, 0, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 18, 0, 1, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity is None, "Granularity, hour to hour but with seconds"
        assert condition == create_condition(
            datetime.datetime(2015, 5, 18, 11), datetime.datetime(2015, 5, 18, 18), 60, 3600
        ), "Condition, hour to hour but with seconds"

        # Even though this is >24h of data, because its a random hour in the middle of the day to the next we use minute
        # granularity
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 18, 15, 1, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity is None, "Granularity, hour to hour but random minute"
        assert condition == create_condition(
            datetime.datetime(2015, 5, 18, 11), datetime.datetime(2015, 5, 18, 18), 60, 3600
        ), "Condition, hour to hour but random minute"

        # Less than a minute, no reason to work hard for such a small window, just use a minute
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 10, 15, 34, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity.granularity == 60, "Granularity, less than a minute"

    def test_granularity_boundaries(self):
        # Need to pick granularity based on the period
        def get_granularity(start, end):
            params = {
                "organization_id": self.organization.id,
                "project_id": [self.project.id],
                "start": start,
                "end": end,
            }
            query = SpansMetricsQueryBuilder(params)
            return query.resolve_split_granularity()

        # See resolve_granularity on the MQB to see what these boundaries are

        # Exactly 30d, at the 30 minute boundary
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 31, 0, 30, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity.granularity == 86400, "Granularity, 30d at boundary"
        assert condition == [], "Condition, 30d at boundary"

        # Near 30d, but 1 hour before the boundary for end
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 30, 23, 29, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity is None, "Granularity, near 30d, but 1 hour before boundary for end"
        assert condition == create_condition(
            datetime.datetime(2015, 5, 2), datetime.datetime(2015, 5, 30), 3600, 86400
        ), "Condition, near 30d but 1 hour before boundary for end"

        # Near 30d, but 1 hour after the boundary for start
        start = datetime.datetime(2015, 5, 1, 1, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 31, 0, 30, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity is None, "Granularity, near 30d, but 1 hour before boundary for start"
        assert condition == create_condition(
            datetime.datetime(2015, 5, 2), datetime.datetime(2015, 5, 31), 3600, 86400
        ), "Condition, near 30d but 1 hour before boundary for start"

        # Exactly 3d
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 4, 0, 30, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity.granularity == 86400, "3d at boundary"
        assert condition == []

        # Near 3d, but 1 hour before the boundary for end
        start = datetime.datetime(2015, 5, 1, 0, 13, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 3, 23, 45, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity is None, "Granularity, near 3d, but 1 hour before boundary for end"
        assert condition == create_condition(
            datetime.datetime(2015, 5, 2), datetime.datetime(2015, 5, 3), 3600, 86400
        ), "Condition, near 3d but 1 hour before boundary for end"

        # Near 3d, but 1 hour after the boundary for start
        start = datetime.datetime(2015, 5, 1, 1, 46, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 4, 0, 46, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity is None, "Granularity, near 3d, but 1 hour before boundary for start"
        assert condition == create_condition(
            datetime.datetime(2015, 5, 2), datetime.datetime(2015, 5, 4), 3600, 86400
        ), "Condition, near 3d but 1 hour before boundary for start"

        # exactly 12 hours
        start = datetime.datetime(2015, 5, 1, 0, 15, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 1, 12, 15, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert granularity.granularity == 3600, "Granularity, 12h at boundary"
        assert condition == [], "Condition, 12h at boundary"

        # Near 12h, but 15 minutes before the boundary for end
        start = datetime.datetime(2015, 5, 1, 0, 15, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 1, 12, 0, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert (
            granularity is None
        ), "Granularity, 12h at boundary, but 15 min before the boundary for end"
        assert condition == create_condition(
            datetime.datetime(2015, 5, 1, 1), datetime.datetime(2015, 5, 1, 12), 60, 3600
        ), "Condition, 12h at boundary, but 15 min before the boundary for end"

        # Near 12h, but 15 minutes after the boundary for start
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 1, 12, 15, 0, tzinfo=timezone.utc)
        condition, granularity = get_granularity(start, end)
        assert (
            granularity is None
        ), "Granularity, 12h at boundary, but 15 min before the boundary for start"
        assert condition == create_condition(
            datetime.datetime(2015, 5, 1, 1), datetime.datetime(2015, 5, 1, 12), 60, 3600
        ), "Condition, 12h at boundary, but 15 min before the boundary for start"


class TimeseriesMetricQueryBuilder(MetricsEnhancedPerformanceTestCase):
    def test_split_granularity(self):
        params = {
            "organization_id": self.organization.id,
            "project_id": [self.project.id],
            "start": datetime.datetime(2015, 5, 18, 23, 3, 0, tzinfo=timezone.utc),
            "end": datetime.datetime(2015, 5, 21, 1, 57, 0, tzinfo=timezone.utc),
        }
        query = TimeseriesSpansMetricsQueryBuilder(params, 86400)
        condition, granularity = query.resolve_split_granularity()
        assert granularity == query.granularity
        assert condition == []
