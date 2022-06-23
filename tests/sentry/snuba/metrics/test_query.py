import re
from datetime import datetime, timedelta
from typing import Optional, Sequence

import pytest
from snuba_sdk import Direction, Granularity, Limit, Offset
from snuba_sdk.conditions import ConditionGroup

from sentry.api.utils import InvalidParams
from sentry.snuba.metrics import (
    DerivedMetricParseException,
    Groupable,
    MetricField,
    MetricsQuery,
    OrderBy,
    parse_query,
)
from sentry.snuba.metrics.naming_layer import SessionMetricKey
from sentry.utils.dates import parse_stats_period


class MetricsQueryBuilder:
    AVG_DURATION_METRIC = MetricField(op="avg", metric_name=SessionMetricKey.DURATION.value)

    def __init__(self):
        now = datetime.now()
        self.org_id: int = 1
        self.project_ids: Sequence[int] = [1, 2]
        self.select: Sequence[MetricField] = [self.AVG_DURATION_METRIC]
        self.start: datetime = now - timedelta(hours=1)
        self.end: datetime = now
        self.granularity: Granularity = Granularity(3600)
        self.orderby: Optional[ConditionGroup] = None
        self.where: Optional[Sequence[Groupable]] = None
        self.groupby: Optional[Sequence[OrderBy]] = None
        self.limit: Optional[Limit] = None
        self.offset: Optional[Offset] = None
        self.histogram_buckets: int = 100
        self.include_series: bool = True
        self.include_totals: bool = True

    def with_select(self, select: Sequence[MetricField]) -> "MetricsQueryBuilder":
        self.select = select
        return self

    def with_start(self, start: datetime) -> "MetricsQueryBuilder":
        self.start = start
        return self

    def with_end(self, end: datetime) -> "MetricsQueryBuilder":
        self.end = end
        return self

    def with_where(self, where: [ConditionGroup]) -> "MetricsQueryBuilder":
        self.where = where
        return self

    def with_orderby(self, orderby: Sequence[OrderBy]) -> "MetricsQueryBuilder":
        self.orderby = orderby
        return self

    def with_granularity(self, granularity: Granularity) -> "MetricsQueryBuilder":
        self.granularity = granularity
        return self

    def with_histogram_buckets(self, histogram_buckets: int) -> "MetricsQueryBuilder":
        self.histogram_buckets = histogram_buckets
        return self

    def with_include_series(self, include_series: bool) -> "MetricsQueryBuilder":
        self.include_series = include_series
        return self

    def with_include_totals(self, include_totals: bool) -> "MetricsQueryBuilder":
        self.include_totals = include_totals
        return self

    def with_limit(self, limit: Limit) -> "MetricsQueryBuilder":
        self.limit = limit
        return self

    def with_groupby(self, groupby: Sequence[Groupable]) -> "MetricsQueryBuilder":
        self.groupby = groupby
        return self

    def to_metrics_query_dict(self):
        return {
            "org_id": self.org_id,
            "project_ids": self.project_ids,
            "start": self.start,
            "end": self.end,
            "granularity": self.granularity,
            "select": self.select,
            "orderby": self.orderby,
            "where": self.where,
            "groupby": self.groupby,
            "limit": self.limit,
            "offset": self.offset,
            "histogram_buckets": self.histogram_buckets,
            "include_series": self.include_series,
            "include_totals": self.include_totals,
        }


def test_validate_select():
    with pytest.raises(InvalidParams, match='Request is missing a "field"'):
        MetricsQuery(**MetricsQueryBuilder().with_select([]).to_metrics_query_dict())

    with pytest.raises(
        InvalidParams,
        match=(
            "Invalid operation 'foo'. Must be one of avg, count_unique, count, max, sum, "
            "histogram, p50, p75, p90, p95, p99"
        ),
    ):
        MetricsQuery(
            **MetricsQueryBuilder()
            .with_select([MetricField(op="foo", metric_name=SessionMetricKey.DURATION.value)])
            .to_metrics_query_dict()
        )
    with pytest.raises(
        DerivedMetricParseException,
        match=(
            re.escape(
                "Failed to parse sum(session.crash_free_rate). No operations can be "
                "applied on this field as it is already a derived metric with an "
                "aggregation applied to it."
            )
        ),
    ):
        MetricsQuery(
            **MetricsQueryBuilder()
            .with_select(
                [MetricField(op="sum", metric_name=SessionMetricKey.CRASH_FREE_RATE.value)]
            )
            .to_metrics_query_dict()
        )


def test_validate_order_by():
    with pytest.raises(
        InvalidParams,
        match=(
            "Invalid operation 'foo'. Must be one of avg, count_unique, count, max, sum, "
            "histogram, p50, p75, p90, p95, p99"
        ),
    ):
        MetricsQuery(
            **MetricsQueryBuilder()
            .with_orderby(
                [
                    OrderBy(
                        field=MetricField(op="foo", metric_name=SessionMetricKey.DURATION.value),
                        direction=Direction.ASC,
                    )
                ]
            )
            .to_metrics_query_dict()
        )
    with pytest.raises(
        DerivedMetricParseException,
        match=(
            re.escape(
                "Failed to parse sum(session.crash_free_rate). No operations can be "
                "applied on this field as it is already a derived metric with an "
                "aggregation applied to it."
            )
        ),
    ):
        MetricsQuery(
            **MetricsQueryBuilder()
            .with_orderby(
                [
                    OrderBy(
                        field=MetricField(
                            op="sum", metric_name=SessionMetricKey.CRASH_FREE_RATE.value
                        ),
                        direction=Direction.ASC,
                    )
                ]
            )
            .to_metrics_query_dict()
        )


def test_validate_order_by_field_in_select():
    metric_field_2 = MetricField(op=None, metric_name=SessionMetricKey.ALL.value)
    metrics_query_dict = (
        MetricsQueryBuilder()
        .with_orderby([OrderBy(field=metric_field_2, direction=Direction.ASC)])
        .to_metrics_query_dict()
    )

    # Test that ensures an instance of `InvalidParams` is raised when requesting an orderBy field
    # that is not present in the select
    with pytest.raises(InvalidParams, match="'orderBy' must be one of the provided 'fields'"):
        MetricsQuery(**metrics_query_dict)

    # Validate no exception is raised when orderBy is in the select
    metrics_query_dict = (
        MetricsQueryBuilder()
        .with_select([MetricsQueryBuilder.AVG_DURATION_METRIC, metric_field_2])
        .to_metrics_query_dict()
    )
    MetricsQuery(**metrics_query_dict)


def test_validate_where():
    query = "session.status:crashed"
    where = parse_query(query, [])

    with pytest.raises(InvalidParams, match="Tag name session.status is not a valid query filter"):
        MetricsQuery(**MetricsQueryBuilder().with_where(where).to_metrics_query_dict())


def test_validate_groupby():
    with pytest.raises(
        InvalidParams, match="Tag name session.status cannot be used to groupBy query"
    ):
        MetricsQuery(
            **MetricsQueryBuilder().with_groupby(["session.status"]).to_metrics_query_dict()
        )


def test_validate_limit():
    with pytest.raises(
        InvalidParams,
        match=(
            "Requested interval of timedelta of 0:01:00 with statsPeriod "
            "timedelta of 1:00:00 is too granular for a per_page of 200 "
            "elements. Increase your interval, decrease your statsPeriod, or decrease your per_page "
            "parameter."
        ),
    ):
        MetricsQuery(
            **MetricsQueryBuilder()
            .with_granularity(Granularity(60))
            .with_limit(Limit(200))
            .to_metrics_query_dict()
        )


def test_validate_end():
    with pytest.raises(InvalidParams, match="start must be before end"):
        MetricsQuery(
            **MetricsQueryBuilder()
            .with_start(datetime.now())
            .with_end(datetime.now() - timedelta(hours=1))
            .to_metrics_query_dict()
        )


def test_series_and_totals_validation():
    metrics_query_dict = (
        MetricsQueryBuilder()
        .with_include_series(False)
        .with_include_totals(False)
        .to_metrics_query_dict()
    )
    with pytest.raises(InvalidParams, match="Cannot omit both series and totals"):
        MetricsQuery(**metrics_query_dict)


@pytest.mark.parametrize(
    "stats_period, interval, error_message",
    [
        pytest.param(
            "6h",
            "59m",
            "The interval should divide one day without a remainder.",
            id="should divide one day",
        ),
        pytest.param(
            "4d",
            "5h",
            "The interval should divide one day without a remainder.",
            id="should divide one day 2",
        ),
        pytest.param(
            "1h",
            "9s",
            "The interval has to be a multiple of the minimum interval of ten seconds.",
            id="interval multiple of min allowed resolution",
        ),
        pytest.param(
            "90d",
            "10s",
            "Your interval and date range would create too many results.",
            id="too many results",
        ),
    ],
)
def test_granularity_validation(stats_period, interval, error_message):
    metrics_query_dict = (
        MetricsQueryBuilder()
        .with_start(datetime.now() - parse_stats_period(stats_period))
        .with_granularity(Granularity(int(parse_stats_period(interval).total_seconds())))
        .to_metrics_query_dict()
    )

    # Test that ensures an instance of `InvalidParams` is raised when requesting an orderBy field
    # that is not present in the select
    with pytest.raises(InvalidParams, match=error_message):
        MetricsQuery(**metrics_query_dict)


def test_validate_histogram_buckets():
    with pytest.raises(
        InvalidParams,
        match="We don't have more than 250 buckets stored for any given metric bucket.",
    ):
        MetricsQuery(**MetricsQueryBuilder().with_histogram_buckets(500).to_metrics_query_dict())
