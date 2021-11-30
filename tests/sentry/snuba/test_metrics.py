from dataclasses import dataclass
from datetime import datetime
from unittest import mock

import pytest
import pytz
from django.utils.datastructures import MultiValueDict
from freezegun import freeze_time
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Limit,
    Offset,
    Op,
    OrderBy,
    Query,
)

from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.snuba.metrics import (
    MAX_POINTS,
    InvalidParams,
    QueryDefinition,
    SnubaQueryBuilder,
    SnubaResultConverter,
    get_date_range,
    get_intervals,
)


@dataclass
class PseudoProject:
    organization_id: int
    id: int


MOCK_NOW = datetime(2021, 8, 25, 23, 59, tzinfo=pytz.utc)


@freeze_time("2018-12-11 03:21:00")
def test_round_range():
    start, end, interval = get_date_range({"statsPeriod": "2d"})
    assert start == datetime(2018, 12, 9, 4, tzinfo=pytz.utc)
    assert end == datetime(2018, 12, 11, 4, tzinfo=pytz.utc)

    start, end, interval = get_date_range({"statsPeriod": "2d", "interval": "1d"})
    assert start == datetime(2018, 12, 10, tzinfo=pytz.utc)
    assert end == datetime(2018, 12, 12, 0, 0, tzinfo=pytz.utc)


def test_invalid_interval():
    with pytest.raises(InvalidParams):
        start, end, interval = get_date_range({"interval": "0d"})


def test_round_exact():
    start, end, interval = get_date_range(
        {"start": "2021-01-12T04:06:16", "end": "2021-01-17T08:26:13", "interval": "1d"},
    )
    assert start == datetime(2021, 1, 12, tzinfo=pytz.utc)
    assert end == datetime(2021, 1, 18, tzinfo=pytz.utc)


def test_exclusive_end():
    start, end, interval = get_date_range(
        {"start": "2021-02-24T00:00:00", "end": "2021-02-25T00:00:00", "interval": "1h"},
    )
    assert start == datetime(2021, 2, 24, tzinfo=pytz.utc)
    assert end == datetime(2021, 2, 25, 0, tzinfo=pytz.utc)


@freeze_time("2021-03-05T11:14:17.105Z")
def test_interval_restrictions():
    # making sure intervals are cleanly divisible
    with pytest.raises(
        InvalidParams, match="The interval should divide one day without a remainder."
    ):
        get_date_range({"statsPeriod": "6h", "interval": "59m"})

    with pytest.raises(
        InvalidParams, match="The interval should divide one day without a remainder."
    ):
        get_date_range({"statsPeriod": "4d", "interval": "5h"})

    with pytest.raises(
        InvalidParams,
        match="The interval has to be a multiple of the minimum interval of ten seconds.",
    ):
        get_date_range({"statsPeriod": "1h", "interval": "9s"})

    with pytest.raises(
        InvalidParams, match="Your interval and date range would create too many results."
    ):
        get_date_range({"statsPeriod": "90d", "interval": "10s"})


@freeze_time("2020-12-18T11:14:17.105Z")
def test_timestamps():
    start, end, interval = get_date_range({"statsPeriod": "1d", "interval": "12h"})
    assert start == datetime(2020, 12, 17, 12, tzinfo=pytz.utc)
    assert end == datetime(2020, 12, 18, 12, tzinfo=pytz.utc)
    assert interval == 12 * 60 * 60


@mock.patch("sentry.snuba.metrics.indexer")
@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_build_snuba_query(mock_now, mock_now2, mock_indexer):

    mock_indexer.resolve = MockIndexer().resolve
    # Your typical release health query querying everything
    query_params = MultiValueDict(
        {
            "query": [
                "release:staging"
            ],  # weird release but we need a string exising in mock indexer
            "groupBy": ["session.status", "environment"],
            "field": [
                "sum(session)",
                "count_unique(user)",
                "p95(session.duration)",
            ],
        }
    )
    query_definition = QueryDefinition(query_params)
    snuba_queries = SnubaQueryBuilder([PseudoProject(1, 1)], query_definition).get_snuba_queries()

    def expected_query(match, select, extra_groupby):
        function, column, alias = select
        return Query(
            dataset="metrics",
            match=Entity(match),
            select=[Function(function, [Column(column)], alias)],
            groupby=[Column("metric_id"), Column("tags[8]"), Column("tags[2]")] + extra_groupby,
            where=[
                Condition(Column("org_id"), Op.EQ, 1),
                Condition(Column("project_id"), Op.IN, [1]),
                Condition(Column("metric_id"), Op.IN, [9, 11, 7]),
                Condition(Column("timestamp"), Op.GTE, datetime(2021, 5, 28, 0, tzinfo=pytz.utc)),
                Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
                Condition(Column("tags[6]"), Op.EQ, 10),
            ],
            limit=Limit(MAX_POINTS),
            offset=Offset(0),
            granularity=Granularity(query_definition.rollup),
        )

    assert snuba_queries["metrics_counters"]["totals"] == expected_query(
        "metrics_counters", ("sum", "value", "value"), []
    )

    expected_percentile_select = ("quantiles(0.5,0.75,0.9,0.95,0.99)", "value", "percentiles")
    assert snuba_queries == {
        "metrics_counters": {
            "totals": expected_query("metrics_counters", ("sum", "value", "value"), []),
            "series": expected_query(
                "metrics_counters", ("sum", "value", "value"), [Column("bucketed_time")]
            ),
        },
        "metrics_sets": {
            "totals": expected_query("metrics_sets", ("uniq", "value", "value"), []),
            "series": expected_query(
                "metrics_sets", ("uniq", "value", "value"), [Column("bucketed_time")]
            ),
        },
        "metrics_distributions": {
            "totals": expected_query("metrics_distributions", expected_percentile_select, []),
            "series": expected_query(
                "metrics_distributions",
                expected_percentile_select,
                [Column("bucketed_time")],
            ),
        },
    }


@mock.patch("sentry.snuba.metrics.indexer")
@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_build_snuba_query_orderby(mock_now, mock_now2, mock_indexer):

    mock_indexer.resolve = MockIndexer().resolve
    query_params = MultiValueDict(
        {
            "query": [
                "release:staging"
            ],  # weird release but we need a string exising in mock indexer
            "groupBy": ["session.status", "environment"],
            "field": [
                "sum(session)",
            ],
            "orderBy": ["-sum(session)"],
            "limit": [3],
        }
    )
    query_definition = QueryDefinition(query_params)
    snuba_queries = SnubaQueryBuilder([PseudoProject(1, 1)], query_definition).get_snuba_queries()

    counter_queries = snuba_queries.pop("metrics_counters")
    assert not snuba_queries
    assert counter_queries["series"] is None  # No series because of orderBy

    assert counter_queries["totals"] == Query(
        dataset="metrics",
        match=Entity("metrics_counters"),
        select=[Function("sum", [Column("value")], "value")],
        groupby=[
            Column("metric_id"),
            Column("tags[8]"),
            Column("tags[2]"),
        ],
        where=[
            Condition(Column("org_id"), Op.EQ, 1),
            Condition(Column("project_id"), Op.IN, [1]),
            Condition(Column("metric_id"), Op.IN, [9]),
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 5, 28, 0, tzinfo=pytz.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
            Condition(Column("tags[6]", entity=None), Op.EQ, 10),
        ],
        orderby=[OrderBy(Column("value"), Direction.DESC)],
        limit=Limit(3),
        offset=Offset(0),
        granularity=Granularity(query_definition.rollup),
    )


@mock.patch("sentry.snuba.metrics.indexer")
@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_translate_results(_1, _2, mock_indexer):
    mock_indexer.reverse_resolve = MockIndexer().reverse_resolve

    query_params = MultiValueDict(
        {
            "groupBy": ["session.status"],
            "field": [
                "sum(session)",
                "max(session.duration)",
                "p50(session.duration)",
                "p95(session.duration)",
            ],
            "interval": ["1d"],
            "statsPeriod": ["2d"],
        }
    )
    query_definition = QueryDefinition(query_params)

    intervals = list(get_intervals(query_definition))
    results = {
        "metrics_counters": {
            "totals": {
                "data": [
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 4,  # session.status:healthy
                        "value": 300,
                    },
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 0,  # session.status:abnormal
                        "value": 330,
                    },
                ],
            },
            "series": {
                "data": [
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 4,
                        "bucketed_time": "2021-08-24T00:00Z",
                        "value": 100,
                    },
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 0,
                        "bucketed_time": "2021-08-24T00:00Z",
                        "value": 110,
                    },
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 4,
                        "bucketed_time": "2021-08-25T00:00Z",
                        "value": 200,
                    },
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 0,
                        "bucketed_time": "2021-08-25T00:00Z",
                        "value": 220,
                    },
                ],
            },
        },
        "metrics_distributions": {
            "totals": {
                "data": [
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 4,
                        "max": 123.4,
                        "percentiles": [1, 2, 3, 4, 5],
                    },
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 0,
                        "max": 456.7,
                        "percentiles": [1.5, 2.5, 3.5, 4.5, 5.5],
                    },
                ],
            },
            "series": {
                "data": [
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 4,
                        "bucketed_time": "2021-08-24T00:00Z",
                        "max": 10.1,
                        "percentiles": [1.1, 2.1, 3.1, 4.1, 5.1],
                    },
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 0,
                        "bucketed_time": "2021-08-24T00:00Z",
                        "max": 20.2,
                        "percentiles": [1.2, 2.2, 3.2, 4.2, 5.2],
                    },
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 4,
                        "bucketed_time": "2021-08-25T00:00Z",
                        "max": 30.3,
                        "percentiles": [1.3, 2.3, 3.3, 4.3, 5.3],
                    },
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 0,
                        "bucketed_time": "2021-08-25T00:00Z",
                        "max": 40.4,
                        "percentiles": [1.4, 2.4, 3.4, 4.4, 5.4],
                    },
                ],
            },
        },
    }

    assert SnubaResultConverter(1, query_definition, intervals, results).translate_results() == [
        {
            "by": {"session.status": "healthy"},
            "totals": {
                "sum(session)": 300,
                "max(session.duration)": 123.4,
                "p50(session.duration)": 1,
                "p95(session.duration)": 4,
            },
            "series": {
                "sum(session)": [100, 200],
                "max(session.duration)": [10.1, 30.3],
                "p50(session.duration)": [1.1, 1.3],
                "p95(session.duration)": [4.1, 4.3],
            },
        },
        {
            "by": {"session.status": "abnormal"},
            "totals": {
                "sum(session)": 330,
                "max(session.duration)": 456.7,
                "p50(session.duration)": 1.5,
                "p95(session.duration)": 4.5,
            },
            "series": {
                "sum(session)": [110, 220],
                "max(session.duration)": [20.2, 40.4],
                "p50(session.duration)": [1.2, 1.4],
                "p95(session.duration)": [4.2, 4.4],
            },
        },
    ]


@mock.patch("sentry.snuba.metrics.indexer")
@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_translate_results_missing_slots(_1, _2, mock_indexer):
    mock_indexer.reverse_resolve = MockIndexer().reverse_resolve
    query_params = MultiValueDict(
        {
            "field": [
                "sum(session)",
            ],
            "interval": ["1d"],
            "statsPeriod": ["3d"],
        }
    )
    query_definition = QueryDefinition(query_params)

    results = {
        "metrics_counters": {
            "totals": {
                "data": [
                    {
                        "metric_id": 9,  # session
                        "value": 400,
                    },
                ],
            },
            "series": {
                "data": [
                    {
                        "metric_id": 9,  # session
                        "bucketed_time": "2021-08-23T00:00Z",
                        "value": 100,
                    },
                    # no data for 2021-08-24
                    {
                        "metric_id": 9,  # session
                        "bucketed_time": "2021-08-25T00:00Z",
                        "value": 300,
                    },
                ],
            },
        },
    }

    intervals = list(get_intervals(query_definition))
    assert SnubaResultConverter(1, query_definition, intervals, results).translate_results() == [
        {
            "by": {},
            "totals": {
                "sum(session)": 400,
            },
            "series": {
                # No data for 2021-08-24
                "sum(session)": [100, 0, 300],
            },
        },
    ]
