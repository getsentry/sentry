from dataclasses import dataclass
from datetime import datetime
from unittest import mock

import pytest
import pytz
from django.utils.datastructures import MultiValueDict
from freezegun import freeze_time
from snuba_sdk import (
    And,
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Limit,
    Offset,
    Op,
    Or,
    OrderBy,
    Query,
)

from sentry.api.utils import InvalidParams
from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.sentry_metrics.utils import resolve_weak
from sentry.snuba.dataset import EntityKey
from sentry.snuba.metrics import (
    MAX_POINTS,
    OP_TO_SNUBA_FUNCTION,
    QueryDefinition,
    SnubaQueryBuilder,
    SnubaResultConverter,
    get_date_range,
    get_intervals,
    parse_query,
    resolve_tags,
)
from sentry.snuba.metrics.fields.snql import (
    all_sessions,
    crashed_sessions,
    errored_preaggr_sessions,
    percentage,
    sessions_errored_set,
)


@dataclass
class PseudoProject:
    organization_id: int
    id: int


MOCK_NOW = datetime(2021, 8, 25, 23, 59, tzinfo=pytz.utc)


def get_entity_of_metric_mocked(_, metric_name):
    return {
        "sentry.sessions.session": EntityKey.MetricsCounters,
        "sentry.sessions.session.error": EntityKey.MetricsSets,
    }[metric_name]


@pytest.mark.parametrize(
    "query_string,expected",
    [
        ('release:""', [Condition(Column(name="tags[6]"), Op.IN, rhs=[15])]),
        ("release:myapp@2.0.0", [Condition(Column(name="tags[6]"), Op.IN, rhs=[16])]),
        (
            "release:myapp@2.0.0 and environment:production",
            [
                And(
                    [
                        Condition(Column(name="tags[6]"), Op.IN, rhs=[16]),
                        Condition(Column(name="tags[2]"), Op.EQ, rhs=5),
                    ]
                )
            ],
        ),
        (
            "release:myapp@2.0.0 environment:production",
            [
                Condition(Column(name="tags[6]"), Op.IN, rhs=[16]),
                Condition(Column(name="tags[2]"), Op.EQ, rhs=5),
            ],
        ),
        (
            "release:myapp@2.0.0 and environment:production or session.status:healthy",
            [
                Or(
                    [
                        And(
                            [
                                Condition(Column(name="tags[6]"), Op.IN, rhs=[16]),
                                Condition(Column(name="tags[2]"), Op.EQ, rhs=5),
                            ]
                        ),
                        Condition(
                            Column(name="tags[8]"),
                            Op.EQ,
                            rhs=4,
                        ),
                    ]
                ),
            ],
        ),
        ('transaction:"/bar/:orgId/"', [Condition(Column(name="tags[17]"), Op.EQ, rhs=18)]),
    ],
)
def test_parse_query(monkeypatch, query_string, expected):
    local_indexer = MockIndexer()
    for s in ("", "myapp@2.0.0", "transaction", "/bar/:orgId/"):
        local_indexer.record(1, s)
    monkeypatch.setattr("sentry.sentry_metrics.indexer.resolve", local_indexer.resolve)
    parsed = resolve_tags(parse_query(query_string))
    assert parsed == expected


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


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_build_snuba_query(mock_now, mock_now2, monkeypatch):
    monkeypatch.setattr("sentry.sentry_metrics.indexer.resolve", MockIndexer().resolve)
    # Your typical release health query querying everything
    query_params = MultiValueDict(
        {
            "query": [
                "release:staging"
            ],  # weird release but we need a string exising in mock indexer
            "groupBy": ["session.status", "environment"],
            "field": [
                "sum(sentry.sessions.session)",
                "count_unique(sentry.sessions.user)",
                "p95(sentry.sessions.session.duration)",
            ],
        }
    )
    query_definition = QueryDefinition(query_params)
    snuba_queries, _ = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition
    ).get_snuba_queries()

    def expected_query(match, select, extra_groupby, metric_name):
        function, column, alias = select
        return Query(
            dataset="metrics",
            match=Entity(match),
            select=[
                Function(
                    OP_TO_SNUBA_FUNCTION[match][alias],
                    [
                        Column("value"),
                        Function("equals", [Column("metric_id"), resolve_weak(metric_name)]),
                    ],
                    alias=f"{alias}({metric_name})",
                )
            ],
            groupby=[Column("tags[8]"), Column("tags[2]")] + extra_groupby,
            where=[
                Condition(Column("org_id"), Op.EQ, 1),
                Condition(Column("project_id"), Op.IN, [1]),
                Condition(Column("timestamp"), Op.GTE, datetime(2021, 5, 28, 0, tzinfo=pytz.utc)),
                Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
                Condition(Column("tags[6]"), Op.IN, [10]),
                Condition(Column("metric_id"), Op.IN, [resolve_weak(metric_name)]),
            ],
            limit=Limit(MAX_POINTS),
            offset=Offset(0),
            granularity=Granularity(query_definition.rollup),
        )

    assert snuba_queries["metrics_counters"]["totals"] == expected_query(
        "metrics_counters", ("sum", "value", "sum"), [], "sentry.sessions.session"
    )

    expected_percentile_select = ("quantiles(0.95)", "value", "p95")
    assert snuba_queries == {
        "metrics_counters": {
            "totals": expected_query(
                "metrics_counters", ("sum", "value", "sum"), [], "sentry.sessions.session"
            ),
            "series": expected_query(
                "metrics_counters",
                ("sum", "value", "sum"),
                [Column("bucketed_time")],
                "sentry.sessions.session",
            ),
        },
        "metrics_sets": {
            "totals": expected_query(
                "metrics_sets", ("uniq", "value", "count_unique"), [], "sentry.sessions.user"
            ),
            "series": expected_query(
                "metrics_sets",
                ("uniq", "value", "count_unique"),
                [Column("bucketed_time")],
                "sentry.sessions.user",
            ),
        },
        "metrics_distributions": {
            "totals": expected_query(
                "metrics_distributions",
                expected_percentile_select,
                [],
                "sentry.sessions.session.duration",
            ),
            "series": expected_query(
                "metrics_distributions",
                expected_percentile_select,
                [Column("bucketed_time")],
                "sentry.sessions.session.duration",
            ),
        },
    }


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
@mock.patch(
    "sentry.snuba.metrics.fields.base._get_entity_of_metric_name", get_entity_of_metric_mocked
)
def test_build_snuba_query_derived_metrics(mock_now, mock_now2, monkeypatch):
    monkeypatch.setattr("sentry.sentry_metrics.indexer.resolve", MockIndexer().resolve)
    # Your typical release health query querying everything
    query_params = MultiValueDict(
        {
            "groupBy": [],
            "field": [
                "session.errored",
                "session.crash_free_rate",
                "session.all",
            ],
            "interval": ["1d"],
            "statsPeriod": ["2d"],
        }
    )
    query_definition = QueryDefinition(query_params)
    query_builder = SnubaQueryBuilder([PseudoProject(1, 1)], query_definition)
    snuba_queries, fields_in_entities = query_builder.get_snuba_queries()
    assert fields_in_entities == {
        "metrics_counters": [
            (None, "session.errored_preaggregated"),
            (None, "session.crash_free_rate"),
            (None, "session.all"),
        ],
        "metrics_sets": [
            (None, "session.errored_set"),
        ],
    }
    for key in ("totals", "series"):
        groupby = [] if key == "totals" else [Column("bucketed_time")]
        assert snuba_queries["metrics_counters"][key] == (
            Query(
                dataset="metrics",
                match=Entity("metrics_counters"),
                select=[
                    errored_preaggr_sessions(
                        metric_ids=[resolve_weak("sentry.sessions.session")],
                        alias="session.errored_preaggregated",
                    ),
                    percentage(
                        crashed_sessions(
                            metric_ids=[resolve_weak("sentry.sessions.session")],
                            alias="session.crashed",
                        ),
                        all_sessions(
                            metric_ids=[resolve_weak("sentry.sessions.session")],
                            alias="session.all",
                        ),
                        alias="session.crash_free_rate",
                    ),
                    all_sessions(
                        metric_ids=[resolve_weak("sentry.sessions.session")], alias="session.all"
                    ),
                ],
                groupby=groupby,
                where=[
                    Condition(Column("org_id"), Op.EQ, 1),
                    Condition(Column("project_id"), Op.IN, [1]),
                    Condition(
                        Column("timestamp"), Op.GTE, datetime(2021, 8, 24, 0, tzinfo=pytz.utc)
                    ),
                    Condition(
                        Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)
                    ),
                    Condition(
                        Column("metric_id"), Op.IN, [resolve_weak("sentry.sessions.session")]
                    ),
                ],
                limit=Limit(MAX_POINTS),
                offset=Offset(0),
                granularity=Granularity(query_definition.rollup),
            )
        )
        assert snuba_queries["metrics_sets"][key] == (
            Query(
                dataset="metrics",
                match=Entity("metrics_sets"),
                select=[
                    sessions_errored_set(
                        metric_ids=[resolve_weak("sentry.sessions.session.error")],
                        alias="session.errored_set",
                    ),
                ],
                groupby=groupby,
                where=[
                    Condition(Column("org_id"), Op.EQ, 1),
                    Condition(Column("project_id"), Op.IN, [1]),
                    Condition(
                        Column("timestamp"), Op.GTE, datetime(2021, 8, 24, 0, tzinfo=pytz.utc)
                    ),
                    Condition(
                        Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)
                    ),
                    Condition(
                        Column("metric_id"), Op.IN, [resolve_weak("sentry.sessions.session.error")]
                    ),
                ],
                limit=Limit(MAX_POINTS),
                offset=Offset(0),
                granularity=Granularity(query_definition.rollup),
            )
        )


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_build_snuba_query_orderby(mock_now, mock_now2, monkeypatch):
    monkeypatch.setattr("sentry.sentry_metrics.indexer.resolve", MockIndexer().resolve)
    query_params = MultiValueDict(
        {
            "query": [
                "release:staging"
            ],  # weird release but we need a string exising in mock indexer
            "groupBy": ["session.status", "environment"],
            "field": [
                "sum(sentry.sessions.session)",
            ],
            "orderBy": ["-sum(sentry.sessions.session)"],
        }
    )
    query_definition = QueryDefinition(query_params, paginator_kwargs={"limit": 3})
    snuba_queries, _ = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition
    ).get_snuba_queries()

    counter_queries = snuba_queries.pop("metrics_counters")
    assert not snuba_queries

    op = "sum"
    metric_name = "sentry.sessions.session"
    select = Function(
        OP_TO_SNUBA_FUNCTION["metrics_counters"]["sum"],
        [Column("value"), Function("equals", [Column("metric_id"), resolve_weak(metric_name)])],
        alias=f"{op}({metric_name})",
    )

    assert counter_queries["totals"] == Query(
        dataset="metrics",
        match=Entity("metrics_counters"),
        select=[select],
        groupby=[
            Column("tags[8]"),
            Column("tags[2]"),
        ],
        where=[
            Condition(Column("org_id"), Op.EQ, 1),
            Condition(Column("project_id"), Op.IN, [1]),
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 5, 28, 0, tzinfo=pytz.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
            Condition(Column("tags[6]", entity=None), Op.IN, [10]),
            Condition(Column("metric_id"), Op.IN, [9]),
        ],
        orderby=[OrderBy(select, Direction.DESC)],
        limit=Limit(3),
        offset=Offset(0),
        granularity=Granularity(query_definition.rollup),
    )
    assert counter_queries["series"] == Query(
        dataset="metrics",
        match=Entity("metrics_counters"),
        select=[select],
        groupby=[
            Column("tags[8]"),
            Column("tags[2]"),
            Column("bucketed_time"),
        ],
        where=[
            Condition(Column("org_id"), Op.EQ, 1),
            Condition(Column("project_id"), Op.IN, [1]),
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 5, 28, 0, tzinfo=pytz.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
            Condition(Column("tags[6]", entity=None), Op.IN, [10]),
            Condition(Column("metric_id"), Op.IN, [9]),
        ],
        orderby=[OrderBy(select, Direction.DESC)],
        limit=Limit(6480),
        offset=Offset(0),
        granularity=Granularity(query_definition.rollup),
    )


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_translate_results(_1, _2, monkeypatch):
    monkeypatch.setattr(
        "sentry.sentry_metrics.indexer.reverse_resolve", MockIndexer().reverse_resolve
    )

    query_params = MultiValueDict(
        {
            "groupBy": ["session.status"],
            "field": [
                "sum(sentry.sessions.session)",
                "max(sentry.sessions.session.duration)",
                "p50(sentry.sessions.session.duration)",
                "p95(sentry.sessions.session.duration)",
            ],
            "interval": ["1d"],
            "statsPeriod": ["2d"],
        }
    )
    query_definition = QueryDefinition(query_params)
    fields_in_entities = {
        "metrics_counters": [("sum", "sentry.sessions.session")],
        "metrics_distributions": [
            ("max", "sentry.sessions.session.duration"),
            ("p50", "sentry.sessions.session.duration"),
            ("p95", "sentry.sessions.session.duration"),
        ],
    }

    intervals = list(get_intervals(query_definition))
    results = {
        "metrics_counters": {
            "totals": {
                "data": [
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 4,  # session.status:healthy
                        "sum(sentry.sessions.session)": 300,
                    },
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 14,  # session.status:abnormal
                        "sum(sentry.sessions.session)": 330,
                    },
                ],
            },
            "series": {
                "data": [
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 4,
                        "bucketed_time": "2021-08-24T00:00Z",
                        "sum(sentry.sessions.session)": 100,
                    },
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 14,
                        "bucketed_time": "2021-08-24T00:00Z",
                        "sum(sentry.sessions.session)": 110,
                    },
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 4,
                        "bucketed_time": "2021-08-25T00:00Z",
                        "sum(sentry.sessions.session)": 200,
                    },
                    {
                        "metric_id": 9,  # session
                        "tags[8]": 14,
                        "bucketed_time": "2021-08-25T00:00Z",
                        "sum(sentry.sessions.session)": 220,
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
                        "max(sentry.sessions.session.duration)": 123.4,
                        "p50(sentry.sessions.session.duration)": [1],
                        "p95(sentry.sessions.session.duration)": [4],
                    },
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 14,
                        "max(sentry.sessions.session.duration)": 456.7,
                        "p50(sentry.sessions.session.duration)": [1.5],
                        "p95(sentry.sessions.session.duration)": [4.5],
                    },
                ],
            },
            "series": {
                "data": [
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 4,
                        "bucketed_time": "2021-08-24T00:00Z",
                        "max(sentry.sessions.session.duration)": 10.1,
                        "p50(sentry.sessions.session.duration)": [1.1],
                        "p95(sentry.sessions.session.duration)": [4.1],
                    },
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 14,
                        "bucketed_time": "2021-08-24T00:00Z",
                        "max(sentry.sessions.session.duration)": 20.2,
                        "p50(sentry.sessions.session.duration)": [1.2],
                        "p95(sentry.sessions.session.duration)": [4.2],
                    },
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 4,
                        "bucketed_time": "2021-08-25T00:00Z",
                        "max(sentry.sessions.session.duration)": 30.3,
                        "p50(sentry.sessions.session.duration)": [1.3],
                        "p95(sentry.sessions.session.duration)": [4.3],
                    },
                    {
                        "metric_id": 7,  # session.duration
                        "tags[8]": 14,
                        "bucketed_time": "2021-08-25T00:00Z",
                        "max(sentry.sessions.session.duration)": 40.4,
                        "p50(sentry.sessions.session.duration)": [1.4],
                        "p95(sentry.sessions.session.duration)": [4.4],
                    },
                ],
            },
        },
    }

    assert SnubaResultConverter(
        1, query_definition, fields_in_entities, intervals, results
    ).translate_results() == [
        {
            "by": {"session.status": "healthy"},
            "totals": {
                "sum(sentry.sessions.session)": 300,
                "max(sentry.sessions.session.duration)": 123.4,
                "p50(sentry.sessions.session.duration)": 1,
                "p95(sentry.sessions.session.duration)": 4,
            },
            "series": {
                "sum(sentry.sessions.session)": [100, 200],
                "max(sentry.sessions.session.duration)": [10.1, 30.3],
                "p50(sentry.sessions.session.duration)": [1.1, 1.3],
                "p95(sentry.sessions.session.duration)": [4.1, 4.3],
            },
        },
        {
            "by": {"session.status": "abnormal"},
            "totals": {
                "sum(sentry.sessions.session)": 330,
                "max(sentry.sessions.session.duration)": 456.7,
                "p50(sentry.sessions.session.duration)": 1.5,
                "p95(sentry.sessions.session.duration)": 4.5,
            },
            "series": {
                "sum(sentry.sessions.session)": [110, 220],
                "max(sentry.sessions.session.duration)": [20.2, 40.4],
                "p50(sentry.sessions.session.duration)": [1.2, 1.4],
                "p95(sentry.sessions.session.duration)": [4.2, 4.4],
            },
        },
    ]


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_translate_results_derived_metrics(_1, _2, monkeypatch):
    monkeypatch.setattr(
        "sentry.sentry_metrics.indexer.reverse_resolve", MockIndexer().reverse_resolve
    )

    query_params = MultiValueDict(
        {
            "groupBy": [],
            "field": [
                "session.errored",
                "session.crash_free_rate",
                "session.all",
            ],
            "interval": ["1d"],
            "statsPeriod": ["2d"],
        }
    )
    query_definition = QueryDefinition(query_params)
    fields_in_entities = {
        "metrics_counters": [
            (None, "session.errored_preaggregated"),
            (None, "session.crash_free_rate"),
            (None, "session.all"),
        ],
        "metrics_sets": [
            (None, "session.errored_set"),
        ],
    }

    intervals = list(get_intervals(query_definition))
    results = {
        "metrics_counters": {
            "totals": {
                "data": [
                    {
                        "session.crash_free_rate": 0.5,
                        "session.all": 8.0,
                        "session.errored_preaggregated": 3,
                    }
                ],
            },
            "series": {
                "data": [
                    {
                        "bucketed_time": "2021-08-24T00:00Z",
                        "session.crash_free_rate": 0.5,
                        "session.all": 4,
                        "session.errored_preaggregated": 1,
                    },
                    {
                        "bucketed_time": "2021-08-25T00:00Z",
                        "session.crash_free_rate": 0.5,
                        "session.all": 4,
                        "session.errored_preaggregated": 2,
                    },
                ],
            },
        },
        "metrics_sets": {
            "totals": {
                "data": [
                    {
                        "session.errored_set": 3,
                    },
                ],
            },
            "series": {
                "data": [
                    {"bucketed_time": "2021-08-24T00:00Z", "session.errored_set": 2},
                    {"bucketed_time": "2021-08-25T00:00Z", "session.errored_set": 1},
                ],
            },
        },
    }

    assert SnubaResultConverter(
        1, query_definition, fields_in_entities, intervals, results
    ).translate_results() == [
        {
            "by": {},
            "totals": {
                "session.all": 8,
                "session.crash_free_rate": 0.5,
                "session.errored": 6,
            },
            "series": {
                "session.all": [4, 4],
                "session.crash_free_rate": [0.5, 0.5],
                "session.errored": [3, 3],
            },
        },
    ]


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_translate_results_missing_slots(_1, _2, monkeypatch):
    monkeypatch.setattr(
        "sentry.sentry_metrics.indexer.reverse_resolve", MockIndexer().reverse_resolve
    )
    query_params = MultiValueDict(
        {
            "field": [
                "sum(sentry.sessions.session)",
            ],
            "interval": ["1d"],
            "statsPeriod": ["3d"],
        }
    )
    query_definition = QueryDefinition(query_params)
    fields_in_entities = {
        "metrics_counters": [
            ("sum", "sentry.sessions.session"),
        ],
    }

    results = {
        "metrics_counters": {
            "totals": {
                "data": [
                    {
                        "metric_id": 9,  # session
                        "sum(sentry.sessions.session)": 400,
                    },
                ],
            },
            "series": {
                "data": [
                    {
                        "metric_id": 9,  # session
                        "bucketed_time": "2021-08-23T00:00Z",
                        "sum(sentry.sessions.session)": 100,
                    },
                    # no data for 2021-08-24
                    {
                        "metric_id": 9,  # session
                        "bucketed_time": "2021-08-25T00:00Z",
                        "sum(sentry.sessions.session)": 300,
                    },
                ],
            },
        },
    }

    intervals = list(get_intervals(query_definition))
    assert SnubaResultConverter(
        1, query_definition, fields_in_entities, intervals, results
    ).translate_results() == [
        {
            "by": {},
            "totals": {
                "sum(sentry.sessions.session)": 400,
            },
            "series": {
                # No data for 2021-08-24
                "sum(sentry.sessions.session)": [100, 0, 300],
            },
        },
    ]
