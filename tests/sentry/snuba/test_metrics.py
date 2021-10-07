from dataclasses import dataclass
from datetime import datetime
from unittest import mock

import pytz
from django.utils.datastructures import MultiValueDict
from snuba_sdk import Column, Condition, Entity, Granularity, Limit, Offset, Op, Query

from sentry.snuba.metrics import (
    MAX_POINTS,
    QueryDefinition,
    SnubaQueryBuilder,
    SnubaResultConverter,
    get_intervals,
)


@dataclass
class PseudoProject:
    organization_id: int
    id: int


MOCK_NOW = datetime(2021, 8, 25, 23, 59, tzinfo=pytz.utc)


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_build_snuba_query(mock_now, mock_now2):

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
    snuba_queries = SnubaQueryBuilder(PseudoProject(1, 1), query_definition).get_snuba_queries()

    def expected_query(match, select, extra_groupby):
        return Query(
            dataset="metrics",
            match=Entity(match),
            select=[Column(select)],
            groupby=[Column("metric_id"), Column("tags[8]"), Column("tags[2]")] + extra_groupby,
            where=[
                Condition(Column("org_id"), Op.EQ, 1),
                Condition(Column("project_id"), Op.EQ, 1),
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
        "metrics_counters", "value", []
    )

    assert snuba_queries == {
        "metrics_counters": {
            "totals": expected_query("metrics_counters", "value", []),
            "series": expected_query("metrics_counters", "value", [Column("bucketed_time")]),
        },
        "metrics_sets": {
            "totals": expected_query("metrics_sets", "value", []),
            "series": expected_query("metrics_sets", "value", [Column("bucketed_time")]),
        },
        "metrics_distributions": {
            "totals": expected_query("metrics_distributions", "percentiles", []),
            "series": expected_query(
                "metrics_distributions", "percentiles", [Column("bucketed_time")]
            ),
        },
    }


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_translate_results(_1, _2):
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
                        "bucketed_time": datetime(2021, 8, 24, tzinfo=pytz.utc),
                        "value": 100,
                    },
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 0,
                        "bucketed_time": datetime(2021, 8, 24, tzinfo=pytz.utc),
                        "value": 110,
                    },
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 4,
                        "bucketed_time": datetime(2021, 8, 25, tzinfo=pytz.utc),
                        "value": 200,
                    },
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 0,
                        "bucketed_time": datetime(2021, 8, 25, tzinfo=pytz.utc),
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
                        "bucketed_time": datetime(2021, 8, 24, tzinfo=pytz.utc),
                        "max": 10.1,
                        "percentiles": [1.1, 2.1, 3.1, 4.1, 5.1],
                    },
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 0,
                        "bucketed_time": datetime(2021, 8, 24, tzinfo=pytz.utc),
                        "max": 20.2,
                        "percentiles": [1.2, 2.2, 3.2, 4.2, 5.2],
                    },
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 4,
                        "bucketed_time": datetime(2021, 8, 25, tzinfo=pytz.utc),
                        "max": 30.3,
                        "percentiles": [1.3, 2.3, 3.3, 4.3, 5.3],
                    },
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 0,
                        "bucketed_time": datetime(2021, 8, 25, tzinfo=pytz.utc),
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


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_translate_results_missing_slots(_1, _2):
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
                        "bucketed_time": datetime(2021, 8, 23, tzinfo=pytz.utc),
                        "value": 100,
                    },
                    # no data for 2021-08-24
                    {
                        "metric_id": 9,  # session
                        "bucketed_time": datetime(2021, 8, 25, tzinfo=pytz.utc),
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
