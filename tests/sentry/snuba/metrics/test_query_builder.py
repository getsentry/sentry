from dataclasses import dataclass
from datetime import datetime, timedelta
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
    OrderBy,
    Query,
)

from sentry.api.utils import InvalidParams
from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.sentry_metrics.utils import resolve, resolve_tag_key, resolve_weak
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
    abnormal_sessions,
    addition,
    all_sessions,
    crashed_sessions,
    errored_preaggr_sessions,
    percentage,
    uniq_aggregation_on_metric,
)
from sentry.snuba.metrics.naming_layer.mapping import get_mri
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.snuba.metrics.query import MetricField
from sentry.snuba.metrics.query_builder import APIQueryDefinition


@dataclass
class PseudoProject:
    organization_id: int
    id: int


MOCK_NOW = datetime(2021, 8, 25, 23, 59, tzinfo=pytz.utc)
ORG_ID = 1


def get_entity_of_metric_mocked(_, metric_name):
    return {
        "sentry.sessions.session": EntityKey.MetricsCounters,
        SessionMRI.SESSION.value: EntityKey.MetricsCounters,
        "sentry.sessions.session.error": EntityKey.MetricsSets,
        SessionMRI.ERROR.value: EntityKey.MetricsSets,
    }[metric_name]


@pytest.mark.parametrize(
    "query_string,expected",
    [
        (
            'release:""',
            [Condition(Column(name=resolve_tag_key(ORG_ID, "release")), Op.IN, rhs=[10000])],
        ),
        (
            "release:myapp@2.0.0",
            [Condition(Column(name=resolve_tag_key(ORG_ID, "release")), Op.IN, rhs=[10001])],
        ),
        (
            "release:myapp@2.0.0 and environment:production",
            [
                And(
                    [
                        Condition(
                            Column(name=resolve_tag_key(ORG_ID, "release")), Op.IN, rhs=[10001]
                        ),
                        Condition(
                            Column(name=resolve_tag_key(ORG_ID, "environment")),
                            Op.EQ,
                            rhs=resolve(ORG_ID, "production"),
                        ),
                    ]
                )
            ],
        ),
        (
            "release:myapp@2.0.0 environment:production",
            [
                Condition(Column(name=resolve_tag_key(ORG_ID, "release")), Op.IN, rhs=[10001]),
                Condition(
                    Column(name=resolve_tag_key(ORG_ID, "environment")),
                    Op.EQ,
                    rhs=resolve(ORG_ID, "production"),
                ),
            ],
        ),
        (
            "release:myapp@2.0.0 and environment:production",
            [
                And(
                    [
                        Condition(
                            Column(name=resolve_tag_key(ORG_ID, "release")), Op.IN, rhs=[10001]
                        ),
                        Condition(
                            Column(name=resolve_tag_key(ORG_ID, "environment")),
                            Op.EQ,
                            rhs=resolve(ORG_ID, "production"),
                        ),
                    ]
                ),
            ],
        ),
        (
            'transaction:"/bar/:orgId/"',
            [Condition(Column(name=resolve_tag_key(ORG_ID, "transaction")), Op.EQ, rhs=10002)],
        ),
    ],
)
def test_parse_query(monkeypatch, query_string, expected):
    org_id = ORG_ID
    local_indexer = MockIndexer()
    for s in ("", "myapp@2.0.0", "/bar/:orgId/"):
        # will be values 10000, 10001, 10002 respectively
        local_indexer.record(org_id, s)
    monkeypatch.setattr("sentry.sentry_metrics.indexer.resolve", local_indexer.resolve)
    parsed = resolve_tags(org_id, parse_query(query_string))
    assert parsed == expected


@pytest.mark.parametrize(
    "query_string",
    [
        "release:myapp@2.0.0 or session.status:init",
        "release:myapp@2.0.0 and environment:production or session.status:healthy",
        "session.status:crashed",
    ],
)
def test_parse_query_invalid(query_string):
    with pytest.raises(InvalidParams):
        parse_query(query_string)


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
    query_definition = QueryDefinition(
        org_id=1,
        project_ids=[1],
        select=[
            MetricField("sum", "sentry.sessions.session"),
            MetricField("count_unique", "sentry.sessions.user"),
            MetricField("p95", "sentry.sessions.session.duration"),
        ],
        start=MOCK_NOW - timedelta(days=90),
        end=MOCK_NOW,
        granularity=Granularity(3600),
        where=[Condition(Column("release"), Op.EQ, "staging")],
        groupby=["environment"],
    )
    snuba_queries, _ = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition
    ).get_snuba_queries()

    org_id = 1

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
                        Function(
                            "equals",
                            [Column("metric_id"), resolve_weak(org_id, get_mri(metric_name))],
                        ),
                    ],
                    alias=f"{alias}({get_mri(metric_name)})",
                )
            ],
            groupby=[Column(resolve_tag_key(org_id, "environment"))] + extra_groupby,
            where=[
                Condition(Column("org_id"), Op.EQ, 1),
                Condition(Column("project_id"), Op.IN, [1]),
                Condition(
                    Column("timestamp"), Op.GTE, datetime(2021, 5, 27, 23, 59, tzinfo=pytz.utc)
                ),
                Condition(
                    Column("timestamp"), Op.LT, datetime(2021, 8, 25, 23, 59, tzinfo=pytz.utc)
                ),
                Condition(
                    Column(resolve_tag_key(org_id, "release")), Op.EQ, resolve(org_id, "staging")
                ),
                Condition(Column("metric_id"), Op.IN, [resolve_weak(org_id, get_mri(metric_name))]),
            ],
            limit=Limit(MAX_POINTS),
            offset=Offset(0),
            granularity=query_definition.granularity,
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
    "sentry.snuba.metrics.fields.base._get_entity_of_metric_mri", get_entity_of_metric_mocked
)
def test_build_snuba_query_derived_metrics(mock_now, mock_now2, monkeypatch):
    org_id = 1
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
    query_definition = APIQueryDefinition([PseudoProject(1, 1)], query_params)
    query_builder = SnubaQueryBuilder([PseudoProject(1, 1)], query_definition.to_query_definition())
    snuba_queries, fields_in_entities = query_builder.get_snuba_queries()
    assert fields_in_entities == {
        "metrics_counters": [
            (None, SessionMRI.ERRORED_PREAGGREGATED.value),
            (None, SessionMRI.CRASHED_AND_ABNORMAL.value),
            (None, SessionMRI.CRASH_FREE_RATE.value),
            (None, SessionMRI.ALL.value),
        ],
        "metrics_sets": [
            (None, SessionMRI.ERRORED_SET.value),
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
                        org_id,
                        metric_ids=[resolve_weak(org_id, SessionMRI.SESSION.value)],
                        alias=SessionMRI.ERRORED_PREAGGREGATED.value,
                    ),
                    addition(
                        crashed_sessions(
                            org_id,
                            metric_ids=[resolve_weak(org_id, SessionMRI.SESSION.value)],
                            alias=SessionMRI.CRASHED.value,
                        ),
                        abnormal_sessions(
                            org_id,
                            metric_ids=[resolve_weak(org_id, SessionMRI.SESSION.value)],
                            alias=SessionMRI.ABNORMAL.value,
                        ),
                        alias=SessionMRI.CRASHED_AND_ABNORMAL.value,
                    ),
                    percentage(
                        crashed_sessions(
                            org_id,
                            metric_ids=[resolve_weak(org_id, SessionMRI.SESSION.value)],
                            alias=SessionMRI.CRASHED.value,
                        ),
                        all_sessions(
                            org_id,
                            metric_ids=[resolve_weak(org_id, SessionMRI.SESSION.value)],
                            alias=SessionMRI.ALL.value,
                        ),
                        alias=SessionMRI.CRASH_FREE_RATE.value,
                    ),
                    all_sessions(
                        org_id,
                        metric_ids=[resolve_weak(org_id, SessionMRI.SESSION.value)],
                        alias=SessionMRI.ALL.value,
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
                        Column("metric_id"),
                        Op.IN,
                        [resolve_weak(org_id, SessionMRI.SESSION.value)],
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
                    uniq_aggregation_on_metric(
                        metric_ids=[resolve_weak(org_id, SessionMRI.ERROR.value)],
                        alias=SessionMRI.ERRORED_SET.value,
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
                        Column("metric_id"),
                        Op.IN,
                        [resolve_weak(org_id, SessionMRI.ERROR.value)],
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
            "groupBy": ["environment"],
            "field": [
                "sum(sentry.sessions.session)",
            ],
            "orderBy": ["-sum(sentry.sessions.session)"],
        }
    )
    query_definition = APIQueryDefinition(
        [PseudoProject(1, 1)], query_params, paginator_kwargs={"limit": 3}
    )
    snuba_queries, _ = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition.to_query_definition()
    ).get_snuba_queries()

    org_id = 1

    counter_queries = snuba_queries.pop("metrics_counters")
    assert not snuba_queries

    op = "sum"
    metric_name = "sentry.sessions.session"
    select = Function(
        OP_TO_SNUBA_FUNCTION["metrics_counters"]["sum"],
        [
            Column("value"),
            Function("equals", [Column("metric_id"), resolve_weak(org_id, get_mri(metric_name))]),
        ],
        alias=f"{op}({get_mri(metric_name)})",
    )

    assert counter_queries["totals"] == Query(
        dataset="metrics",
        match=Entity("metrics_counters"),
        select=[select],
        groupby=[
            Column(resolve_tag_key(org_id, "environment")),
        ],
        where=[
            Condition(Column("org_id"), Op.EQ, 1),
            Condition(Column("project_id"), Op.IN, [1]),
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 5, 28, 0, tzinfo=pytz.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
            Condition(
                Column(resolve_tag_key(org_id, "release"), entity=None),
                Op.IN,
                [resolve(org_id, "staging")],
            ),
            Condition(Column("metric_id"), Op.IN, [resolve(org_id, get_mri(metric_name))]),
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
            Column(resolve_tag_key(org_id, "environment")),
            Column("bucketed_time"),
        ],
        where=[
            Condition(Column("org_id"), Op.EQ, 1),
            Condition(Column("project_id"), Op.IN, [1]),
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 5, 28, 0, tzinfo=pytz.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
            Condition(
                Column(resolve_tag_key(org_id, "release"), entity=None),
                Op.IN,
                [resolve(org_id, "staging")],
            ),
            Condition(Column("metric_id"), Op.IN, [resolve(org_id, get_mri(metric_name))]),
        ],
        orderby=[OrderBy(select, Direction.DESC)],
        limit=Limit(6480),
        offset=Offset(0),
        granularity=Granularity(query_definition.rollup),
    )


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_build_snuba_query_with_derived_alias(mock_now, mock_now2, monkeypatch):
    monkeypatch.setattr("sentry.sentry_metrics.indexer.resolve", MockIndexer().resolve)
    query_params = MultiValueDict(
        {
            "query": ["release:staging"],
            "groupBy": ["environment"],
            "field": [
                "p95(session.duration)",
            ],
        }
    )
    query_definition = APIQueryDefinition(
        [PseudoProject(1, 1)], query_params, paginator_kwargs={"limit": 3}
    )
    snuba_queries, _ = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition.to_query_definition()
    ).get_snuba_queries()

    org_id = 1

    distribution_queries = snuba_queries.pop("metrics_distributions")
    assert not snuba_queries

    op = "p95"

    conditions = [
        Function(
            "equals", [Column("metric_id"), resolve_weak(org_id, SessionMRI.RAW_DURATION.value)]
        ),
        Function(
            "equals",
            (
                Column(f"tags[{resolve_weak(org_id, 'session.status')}]"),
                resolve_weak(org_id, "exited"),
            ),
        ),
    ]

    select = Function(
        OP_TO_SNUBA_FUNCTION["metrics_distributions"]["p95"],
        [
            Column("value"),
            Function("and", conditions),
        ],
        alias=f"{op}({SessionMRI.DURATION.value})",
    )
    assert distribution_queries["totals"] == Query(
        dataset="metrics",
        match=Entity("metrics_distributions"),
        select=[select],
        groupby=[
            Column(resolve_tag_key(org_id, "environment")),
        ],
        where=[
            Condition(Column("org_id"), Op.EQ, 1),
            Condition(Column("project_id"), Op.IN, [1]),
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 5, 28, 0, tzinfo=pytz.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
            Condition(
                Column(resolve_tag_key(org_id, "release"), entity=None),
                Op.IN,
                [resolve(org_id, "staging")],
            ),
            Condition(Column("metric_id"), Op.IN, [resolve(org_id, SessionMRI.RAW_DURATION.value)]),
        ],
        limit=Limit(MAX_POINTS),
        offset=Offset(0),
        granularity=Granularity(query_definition.rollup),
    )
    assert distribution_queries["series"] == Query(
        dataset="metrics",
        match=Entity("metrics_distributions"),
        select=[select],
        groupby=[
            Column(resolve_tag_key(org_id, "environment")),
            Column("bucketed_time"),
        ],
        where=[
            Condition(Column("org_id"), Op.EQ, 1),
            Condition(Column("project_id"), Op.IN, [1]),
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 5, 28, 0, tzinfo=pytz.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
            Condition(
                Column(resolve_tag_key(org_id, "release"), entity=None),
                Op.IN,
                [resolve(org_id, "staging")],
            ),
            Condition(Column("metric_id"), Op.IN, [resolve(org_id, SessionMRI.RAW_DURATION.value)]),
        ],
        limit=Limit(MAX_POINTS),
        offset=Offset(0),
        granularity=Granularity(query_definition.rollup),
    )


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_translate_results(_1, _2, monkeypatch):
    org_id = 1
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
    query_definition = APIQueryDefinition([PseudoProject(1, 1)], query_params)
    fields_in_entities = {
        "metrics_counters": [("sum", SessionMRI.SESSION.value)],
        "metrics_distributions": [
            ("max", SessionMRI.RAW_DURATION.value),
            ("p50", SessionMRI.RAW_DURATION.value),
            ("p95", SessionMRI.RAW_DURATION.value),
        ],
    }

    intervals = list(
        get_intervals(query_definition.start, query_definition.end, query_definition.rollup)
    )

    session_metric_id = resolve(org_id, SessionMRI.SESSION.value)
    session_dur_metric_id = resolve(org_id, SessionMRI.RAW_DURATION.value)
    session_status = resolve_tag_key(org_id, "session.status")
    healthy = resolve(org_id, "healthy")
    abnormal = resolve(org_id, "abnormal")

    results = {
        "metrics_counters": {
            "totals": {
                "data": [
                    {
                        "metric_id": session_metric_id,
                        session_status: healthy,
                        f"sum({SessionMRI.SESSION.value})": 300,
                    },
                    {
                        "metric_id": session_metric_id,
                        session_status: abnormal,
                        f"sum({SessionMRI.SESSION.value})": 330,
                    },
                ],
            },
            "series": {
                "data": [
                    {
                        "metric_id": session_metric_id,
                        session_status: healthy,
                        "bucketed_time": "2021-08-24T00:00Z",
                        f"sum({SessionMRI.SESSION.value})": 100,
                    },
                    {
                        "metric_id": session_metric_id,
                        session_status: abnormal,
                        "bucketed_time": "2021-08-24T00:00Z",
                        f"sum({SessionMRI.SESSION.value})": 110,
                    },
                    {
                        "metric_id": session_metric_id,
                        session_status: healthy,
                        "bucketed_time": "2021-08-25T00:00Z",
                        f"sum({SessionMRI.SESSION.value})": 200,
                    },
                    {
                        "metric_id": session_metric_id,
                        session_status: abnormal,
                        "bucketed_time": "2021-08-25T00:00Z",
                        f"sum({SessionMRI.SESSION.value})": 220,
                    },
                ],
            },
        },
        "metrics_distributions": {
            "totals": {
                "data": [
                    {
                        "metric_id": session_dur_metric_id,
                        session_status: healthy,
                        f"max({SessionMRI.RAW_DURATION.value})": 123.4,
                        f"p50({SessionMRI.RAW_DURATION.value})": [1],
                        f"p95({SessionMRI.RAW_DURATION.value})": [4],
                    },
                    {
                        "metric_id": session_dur_metric_id,
                        session_status: abnormal,
                        f"max({SessionMRI.RAW_DURATION.value})": 456.7,
                        f"p50({SessionMRI.RAW_DURATION.value})": [1.5],
                        f"p95({SessionMRI.RAW_DURATION.value})": [4.5],
                    },
                ],
            },
            "series": {
                "data": [
                    {
                        "metric_id": session_dur_metric_id,
                        session_status: healthy,
                        "bucketed_time": "2021-08-24T00:00Z",
                        f"max({SessionMRI.RAW_DURATION.value})": 10.1,
                        f"p50({SessionMRI.RAW_DURATION.value})": [1.1],
                        f"p95({SessionMRI.RAW_DURATION.value})": [4.1],
                    },
                    {
                        "metric_id": session_dur_metric_id,
                        session_status: abnormal,
                        "bucketed_time": "2021-08-24T00:00Z",
                        f"max({SessionMRI.RAW_DURATION.value})": 20.2,
                        f"p50({SessionMRI.RAW_DURATION.value})": [1.2],
                        f"p95({SessionMRI.RAW_DURATION.value})": [4.2],
                    },
                    {
                        "metric_id": session_dur_metric_id,
                        session_status: healthy,
                        "bucketed_time": "2021-08-25T00:00Z",
                        f"max({SessionMRI.RAW_DURATION.value})": 30.3,
                        f"p50({SessionMRI.RAW_DURATION.value})": [1.3],
                        f"p95({SessionMRI.RAW_DURATION.value})": [4.3],
                    },
                    {
                        "metric_id": session_dur_metric_id,
                        session_status: abnormal,
                        "bucketed_time": "2021-08-25T00:00Z",
                        f"max({SessionMRI.RAW_DURATION.value})": 40.4,
                        f"p50({SessionMRI.RAW_DURATION.value})": [1.4],
                        f"p95({SessionMRI.RAW_DURATION.value})": [4.4],
                    },
                ],
            },
        },
    }

    assert SnubaResultConverter(
        org_id, query_definition.to_query_definition(), fields_in_entities, intervals, results
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
    query_definition = APIQueryDefinition([PseudoProject(1, 1)], query_params)
    fields_in_entities = {
        "metrics_counters": [
            (None, SessionMRI.ERRORED_PREAGGREGATED.value),
            (None, SessionMRI.CRASHED_AND_ABNORMAL.value),
            (None, SessionMRI.CRASH_FREE_RATE.value),
            (None, SessionMRI.ALL.value),
        ],
        "metrics_sets": [
            (None, SessionMRI.ERRORED_SET.value),
        ],
    }

    intervals = list(
        get_intervals(query_definition.start, query_definition.end, query_definition.rollup)
    )
    results = {
        "metrics_counters": {
            "totals": {
                "data": [
                    {
                        SessionMRI.CRASH_FREE_RATE.value: 0.5,
                        SessionMRI.ALL.value: 8.0,
                        SessionMRI.ERRORED_PREAGGREGATED.value: 3,
                        SessionMRI.CRASHED_AND_ABNORMAL.value: 0,
                    }
                ],
            },
            "series": {
                "data": [
                    {
                        "bucketed_time": "2021-08-24T00:00Z",
                        SessionMRI.CRASH_FREE_RATE.value: 0.5,
                        SessionMRI.ALL.value: 4,
                        SessionMRI.ERRORED_PREAGGREGATED.value: 1,
                        SessionMRI.CRASHED_AND_ABNORMAL.value: 0,
                    },
                    {
                        "bucketed_time": "2021-08-25T00:00Z",
                        SessionMRI.CRASH_FREE_RATE.value: 0.5,
                        SessionMRI.ALL.value: 4,
                        SessionMRI.ERRORED_PREAGGREGATED.value: 2,
                        SessionMRI.CRASHED_AND_ABNORMAL.value: 0,
                    },
                ],
            },
        },
        "metrics_sets": {
            "totals": {
                "data": [
                    {
                        SessionMRI.ERRORED_SET.value: 3,
                    },
                ],
            },
            "series": {
                "data": [
                    {"bucketed_time": "2021-08-24T00:00Z", SessionMRI.ERRORED_SET.value: 2},
                    {"bucketed_time": "2021-08-25T00:00Z", SessionMRI.ERRORED_SET.value: 1},
                ],
            },
        },
    }

    assert SnubaResultConverter(
        1, query_definition.to_query_definition(), fields_in_entities, intervals, results
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
    org_id = 1
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
    query_definition = APIQueryDefinition([PseudoProject(1, 1)], query_params)
    fields_in_entities = {
        "metrics_counters": [
            ("sum", SessionMRI.SESSION.value),
        ],
    }

    results = {
        "metrics_counters": {
            "totals": {
                "data": [
                    {
                        "metric_id": resolve(org_id, SessionMRI.SESSION.value),
                        f"sum({SessionMRI.SESSION.value})": 400,
                    },
                ],
            },
            "series": {
                "data": [
                    {
                        "metric_id": resolve(org_id, SessionMRI.SESSION.value),
                        "bucketed_time": "2021-08-23T00:00Z",
                        f"sum({SessionMRI.SESSION.value})": 100,
                    },
                    # no data for 2021-08-24
                    {
                        "metric_id": resolve(org_id, SessionMRI.SESSION.value),
                        "bucketed_time": "2021-08-25T00:00Z",
                        f"sum({SessionMRI.SESSION.value})": 300,
                    },
                ],
            },
        },
    }

    intervals = list(
        get_intervals(query_definition.start, query_definition.end, query_definition.rollup)
    )
    assert SnubaResultConverter(
        org_id, query_definition.to_query_definition(), fields_in_entities, intervals, results
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


def test_get_intervals():
    with pytest.raises(AssertionError):
        list(get_intervals(MOCK_NOW - timedelta(days=1), MOCK_NOW, -3600))
