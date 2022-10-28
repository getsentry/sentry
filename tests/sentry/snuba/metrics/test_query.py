import re
from datetime import datetime, timedelta
from typing import Optional, Sequence

import pytest
from snuba_sdk import Direction, Granularity, Limit, Offset
from snuba_sdk.conditions import ConditionGroup

from sentry.api.utils import InvalidParams
from sentry.snuba.metrics import (
    OPERATIONS,
    DerivedMetricParseException,
    Groupable,
    MetricField,
    MetricGroupByField,
    MetricsQuery,
    OrderBy,
    parse_query,
)
from sentry.snuba.metrics.naming_layer import SessionMRI, TransactionMRI
from sentry.utils.dates import parse_stats_period


class MetricsQueryBuilder:
    AVG_DURATION_METRIC = MetricField(op="avg", metric_mri=SessionMRI.DURATION.value)

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
        self.groupby: Optional[Sequence[MetricGroupByField]] = None
        self.limit: Optional[Limit] = None
        self.offset: Optional[Offset] = None
        self.include_series: bool = True
        self.include_totals: bool = True
        self.interval: Optional[int] = None

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

    def with_include_series(self, include_series: bool) -> "MetricsQueryBuilder":
        self.include_series = include_series
        return self

    def with_include_totals(self, include_totals: bool) -> "MetricsQueryBuilder":
        self.include_totals = include_totals
        return self

    def with_limit(self, limit: Limit) -> "MetricsQueryBuilder":
        self.limit = limit
        return self

    def with_groupby(self, groupby: Sequence[MetricGroupByField]) -> "MetricsQueryBuilder":
        self.groupby = groupby
        return self

    def with_interval(self, interval: int) -> "MetricsQueryBuilder":
        self.interval = interval
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
            "include_series": self.include_series,
            "include_totals": self.include_totals,
            "interval": self.interval,
        }


def test_metric_field_equality_with_equal_fields():
    ap_dex_with_alias_1 = MetricField(op=None, metric_mri=TransactionMRI.APDEX.value, alias="apdex")
    ap_dex_with_alias_2 = MetricField(op=None, metric_mri=TransactionMRI.APDEX.value, alias="apdex")

    assert ap_dex_with_alias_1 == ap_dex_with_alias_2


def test_metric_field_equality_with_different_aliases():
    ap_dex_with_alias_1 = MetricField(op=None, metric_mri=TransactionMRI.APDEX.value, alias="apdex")
    ap_dex_with_alias_2 = MetricField(
        op=None, metric_mri=TransactionMRI.APDEX.value, alias="transaction.apdex"
    )

    assert ap_dex_with_alias_1 == ap_dex_with_alias_2


def test_metric_field_equality_with_different_mris():
    ap_dex_with_alias_1 = MetricField(op=None, metric_mri=TransactionMRI.APDEX.value, alias="apdex")
    ap_dex_with_alias_2 = MetricField(
        op=None, metric_mri=TransactionMRI.DURATION.value, alias="duration"
    )

    assert not ap_dex_with_alias_1 == ap_dex_with_alias_2


def test_validate_select():
    with pytest.raises(InvalidParams, match='Request is missing a "field"'):
        MetricsQuery(**MetricsQueryBuilder().with_select([]).to_metrics_query_dict())

    with pytest.raises(
        InvalidParams,
        match=(f"Invalid operation 'foo'. Must be one of {', '.join(OPERATIONS)}"),
    ):
        MetricsQuery(
            **MetricsQueryBuilder()
            .with_select([MetricField(op="foo", metric_mri=SessionMRI.DURATION.value)])
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
            .with_select([MetricField(op="sum", metric_mri=SessionMRI.CRASH_FREE_RATE.value)])
            .to_metrics_query_dict()
        )


def test_validate_select_invalid_use_case_ids():
    with pytest.raises(InvalidParams, match="All select fields should have the same use_case_id"):
        metric_field_1 = MetricField(op=None, metric_mri=SessionMRI.CRASH_FREE_RATE.value)
        metric_field_2 = MetricField(op="p50", metric_mri=TransactionMRI.DURATION.value)
        MetricsQuery(
            **MetricsQueryBuilder()
            .with_select([metric_field_1, metric_field_2])
            .to_metrics_query_dict()
        )


def test_validate_order_by():
    with pytest.raises(
        InvalidParams,
        match=(f"Invalid operation 'foo'. Must be one of {', '.join(OPERATIONS)}"),
    ):
        MetricsQuery(
            **MetricsQueryBuilder()
            .with_orderby(
                [
                    OrderBy(
                        field=MetricField(op="foo", metric_mri=SessionMRI.DURATION.value),
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
                        field=MetricField(op="sum", metric_mri=SessionMRI.CRASH_FREE_RATE.value),
                        direction=Direction.ASC,
                    )
                ]
            )
            .to_metrics_query_dict()
        )


@pytest.mark.django_db(True)
def test_validate_order_by_field_in_select():
    metric_field_2 = MetricField(op=None, metric_mri=SessionMRI.ALL.value)
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


@pytest.mark.django_db(True)
def test_validate_order_by_field_in_select_with_different_alias():
    ap_dex_with_alias_1 = MetricField(op=None, metric_mri=TransactionMRI.APDEX.value, alias="apdex")
    ap_dex_with_alias_2 = MetricField(
        op=None, metric_mri=TransactionMRI.APDEX.value, alias="transaction.apdex"
    )

    try:
        metrics_query_dict = (
            MetricsQueryBuilder()
            .with_select([ap_dex_with_alias_1])
            .with_orderby([OrderBy(field=ap_dex_with_alias_2, direction=Direction.ASC)])
            .to_metrics_query_dict()
        )
        MetricsQuery(**metrics_query_dict)
    except InvalidParams:
        raise pytest.fail(
            "the validation of orderby field in select with different alias is throwing an error but it "
            "shouldn't."
        )


@pytest.mark.django_db(True)
def test_validate_multiple_orderby_columns_not_specified_in_select():
    metric_field_1 = MetricField(op=None, metric_mri=SessionMRI.ABNORMAL.value)
    metric_field_2 = MetricField(op=None, metric_mri=SessionMRI.ALL.value)
    metrics_query_dict = (
        MetricsQueryBuilder()
        .with_select([MetricsQueryBuilder.AVG_DURATION_METRIC, metric_field_1])
        .with_orderby(
            [
                OrderBy(field=metric_field_1, direction=Direction.ASC),
                OrderBy(field=metric_field_2, direction=Direction.ASC),
            ]
        )
        .to_metrics_query_dict()
    )

    # Test that ensures an instance of `InvalidParams` is raised when requesting an orderBy field
    # that is not present in the select
    with pytest.raises(InvalidParams, match="'orderBy' must be one of the provided 'fields'"):
        MetricsQuery(**metrics_query_dict)


@pytest.mark.django_db(True)
def test_validate_multiple_order_by_fields_from_multiple_entities():
    """
    The example should fail because session crash free rate is generated from
    counters entity while p50 of duration will go to distribution
    """
    metric_field_1 = MetricField(op=None, metric_mri=SessionMRI.CRASH_FREE_RATE.value)
    metric_field_2 = MetricField(op=None, metric_mri=SessionMRI.CRASH_FREE_USER_RATE.value)
    metric_field_3 = MetricField(op="p50", metric_mri=TransactionMRI.DURATION.value)
    metrics_query_dict = (
        MetricsQueryBuilder()
        .with_select([metric_field_1, metric_field_2])
        .with_orderby(
            [
                OrderBy(field=metric_field_1, direction=Direction.ASC),
                OrderBy(field=metric_field_3, direction=Direction.ASC),
            ]
        )
        .to_metrics_query_dict()
    )

    # Test that ensures an instance of `InvalidParams` is raised when requesting an orderBy field
    # that is not present in the select
    with pytest.raises(
        InvalidParams, match="Selected 'orderBy' columns must belongs to the same entity"
    ):
        MetricsQuery(**metrics_query_dict)


@pytest.mark.django_db(True)
def test_validate_multiple_orderby_derived_metrics_from_different_entities():
    """
    This example should fail because session crash free rate is generated from
    counters while session user crash free rate is generated from sets
    """
    metric_field_1 = MetricField(op=None, metric_mri=SessionMRI.CRASH_FREE_RATE.value)
    metric_field_2 = MetricField(op=None, metric_mri=SessionMRI.CRASH_FREE_USER_RATE.value)
    metrics_query_dict = (
        MetricsQueryBuilder()
        .with_select([metric_field_1, metric_field_2])
        .with_orderby(
            [
                OrderBy(field=metric_field_1, direction=Direction.ASC),
                OrderBy(field=metric_field_2, direction=Direction.ASC),
            ]
        )
        .to_metrics_query_dict()
    )

    # Test that ensures an instance of `InvalidParams` is raised when requesting an orderBy field
    # that is not present in the select
    with pytest.raises(
        InvalidParams, match="Selected 'orderBy' columns must belongs to the same entity"
    ):
        MetricsQuery(**metrics_query_dict)


@pytest.mark.django_db(True)
def test_validate_many_order_by_fields_are_in_select():
    """
    Validate no exception is raised when all orderBy fields are presented the select
    """
    metric_field_1 = MetricField(op=None, metric_mri=SessionMRI.ABNORMAL.value)
    metric_field_2 = MetricField(op=None, metric_mri=SessionMRI.ALL.value)

    metrics_query_dict = (
        MetricsQueryBuilder()
        .with_select([metric_field_1, metric_field_2])
        .with_orderby(
            [
                OrderBy(field=metric_field_1, direction=Direction.ASC),
                OrderBy(field=metric_field_2, direction=Direction.ASC),
            ]
        )
        .to_metrics_query_dict()
    )
    MetricsQuery(**metrics_query_dict)

    # orderby should be subset of select
    metrics_query_dict = (
        MetricsQueryBuilder()
        .with_select([metric_field_1, metric_field_2])
        .with_orderby(
            [
                OrderBy(field=metric_field_1, direction=Direction.ASC),
            ]
        )
        .to_metrics_query_dict()
    )
    MetricsQuery(**metrics_query_dict)

    # This example should pass because both session crash free rate
    # and sum(session) both go to the entity counters
    metric_field_1 = MetricField(op=None, metric_mri=SessionMRI.CRASH_FREE_RATE.value)
    metric_field_2 = MetricField(op="sum", metric_mri=SessionMRI.SESSION.value)
    metrics_query_dict = (
        MetricsQueryBuilder()
        .with_select([metric_field_1, metric_field_2])
        .with_orderby(
            [
                OrderBy(field=metric_field_1, direction=Direction.ASC),
                OrderBy(field=metric_field_2, direction=Direction.ASC),
            ]
        )
        .to_metrics_query_dict()
    )

    MetricsQuery(**metrics_query_dict)


def test_validate_functions_from_multiple_entities_in_orderby():
    # Validate exception is raised when orderBy fields have function from different snuba groups
    # because:
    # `avg` are in OP_TO_SNUBA_FUNCTION["metrics_distributions"].keys()
    # but
    # `count_unique` are in OP_TO_SNUBA_FUNCTION["metrics_sets"].keys()
    metric_field_1 = MetricField(op="avg", metric_mri=TransactionMRI.DURATION.value)
    metric_field_2 = MetricField(op="count_unique", metric_mri=TransactionMRI.USER.value)

    metrics_query_dict = (
        MetricsQueryBuilder()
        .with_select([metric_field_1, metric_field_2])
        .with_orderby(
            [
                OrderBy(field=metric_field_1, direction=Direction.ASC),
                OrderBy(field=metric_field_2, direction=Direction.ASC),
            ]
        )
        .to_metrics_query_dict()
    )

    # Test that ensures an instance of `InvalidParams` is raised when requesting an orderBy field
    # from different snuba function groups
    with pytest.raises(
        InvalidParams,
        match="Selected 'orderBy' columns must belongs to the same entity",
    ):
        MetricsQuery(**metrics_query_dict)


def test_validate_distribution_functions_in_orderby():
    # Validate no exception is raised when all orderBy fields are presented the select
    metric_field_1 = MetricField(op="avg", metric_mri=TransactionMRI.DURATION.value)
    metric_field_2 = MetricField(op="p50", metric_mri=TransactionMRI.DURATION.value)

    metrics_query_dict = (
        MetricsQueryBuilder()
        .with_select([metric_field_1, metric_field_2])
        .with_orderby(
            [
                OrderBy(field=metric_field_1, direction=Direction.ASC),
                OrderBy(field=metric_field_2, direction=Direction.ASC),
            ]
        )
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
        InvalidParams, match="Tag name session.status cannot be used in groupBy query"
    ):
        MetricsQuery(
            **MetricsQueryBuilder()
            .with_groupby([MetricGroupByField("session.status")])
            .to_metrics_query_dict()
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


def test_validate_metric_field_mri():
    with pytest.raises(InvalidParams, match="Invalid Metric MRI: transaction-metric-duration"):
        MetricField(
            op="avg",
            metric_mri="transaction-metric-duration",
        )


@pytest.mark.parametrize(
    "alias",
    [
        pytest.param(
            None,
            id="No alias provided",
        ),
        pytest.param(
            "ahmed_alias",
            id="alias is provided",
        ),
    ],
)
def test_validate_metric_field_mri_is_public(alias):
    with pytest.raises(
        InvalidParams,
        match="Unable to find a mri reverse mapping for 'e:sessions/error.preaggr@none'.",
    ):
        MetricField(op=None, metric_mri="e:sessions/error.preaggr@none", alias=alias)


@pytest.mark.parametrize(
    "select, interval, series",
    [
        pytest.param(
            None,
            3600,
            False,
            id="release health query, not series, interval provided",
        ),
        pytest.param(
            None,
            3600,
            True,
            id="release health query, series, interval provided",
        ),
        pytest.param(
            [MetricField(op="p95", metric_mri=TransactionMRI.DURATION.value)],
            3600,
            False,
            id="performance query, not series, interval provided",
        ),
    ],
)
def test_validate_interval(select, interval, series):
    metrics_query = MetricsQueryBuilder().with_include_series(series)
    if select:
        metrics_query = metrics_query.with_select(select)
    if interval:
        metrics_query = metrics_query.with_interval(interval)
    metrics_query_dict = metrics_query.to_metrics_query_dict()

    with pytest.raises(
        InvalidParams, match="Interval is only supported for timeseries performance queries"
    ):
        MetricsQuery(**metrics_query_dict)


def test_ensure_interval_set_to_granularity_in_performance_queries():
    metrics_query = (
        MetricsQueryBuilder()
        .with_select([MetricField(op="p95", metric_mri=TransactionMRI.DURATION.value)])
        .with_include_series(True)
    )
    metrics_query_dict = metrics_query.to_metrics_query_dict()
    mq = MetricsQuery(**metrics_query_dict)
    assert mq.interval == mq.granularity.granularity


@pytest.mark.parametrize(
    "granularity, interval, expected_granularity",
    [
        pytest.param(
            86400,
            7200,
            3600,
            id="day granularity with 2 hour interval",
        ),
        pytest.param(
            3600,
            1800,
            60,
            id="hour granularity with 30 minute interval",
        ),
    ],
)
def test_ensure_granularity_is_less_than_interval(granularity, interval, expected_granularity):
    metrics_query = (
        MetricsQueryBuilder()
        .with_select([MetricField(op="p95", metric_mri=TransactionMRI.DURATION.value)])
        .with_include_series(True)
        .with_granularity(Granularity(granularity))
        .with_interval(interval)
    )
    metrics_query_dict = metrics_query.to_metrics_query_dict()
    mq = MetricsQuery(**metrics_query_dict)
    assert mq.granularity.granularity == expected_granularity
