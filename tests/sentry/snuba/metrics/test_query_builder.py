from __future__ import annotations

import re
import types
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest import mock

import pytest
import sentry_sdk
from django.utils.datastructures import MultiValueDict
from snuba_sdk import (
    AliasedExpression,
    And,
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Limit,
    Op,
    Or,
    OrderBy,
    Query,
)

from sentry.exceptions import InvalidParams
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import (
    resolve,
    resolve_tag_key,
    resolve_tag_value,
    resolve_tag_values,
    resolve_weak,
)
from sentry.snuba.dataset import EntityKey
from sentry.snuba.metrics import (
    MAX_POINTS,
    OP_TO_SNUBA_FUNCTION,
    DeprecatingMetricsQuery,
    MetricOperationType,
    SnubaQueryBuilder,
    SnubaResultConverter,
    get_date_range,
    get_intervals,
    parse_conditions,
    resolve_tags,
    translate_meta_results,
)
from sentry.snuba.metrics.fields.base import (
    COMPOSITE_ENTITY_CONSTITUENT_ALIAS,
    CompositeEntityDerivedMetric,
    SingularEntityDerivedMetric,
)
from sentry.snuba.metrics.fields.snql import (
    abnormal_sessions,
    addition,
    all_sessions,
    complement,
    crashed_sessions,
    division_float,
    errored_preaggr_sessions,
    uniq_aggregation_on_metric,
)
from sentry.snuba.metrics.naming_layer import SessionMetricKey
from sentry.snuba.metrics.naming_layer.mapping import get_mri
from sentry.snuba.metrics.naming_layer.mri import SessionMRI, TransactionMRI
from sentry.snuba.metrics.query import MetricConditionField, MetricField, MetricGroupByField
from sentry.snuba.metrics.query_builder import QUERY_PROJECT_LIMIT, QueryDefinition
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.pytest.fixtures import django_db_all

pytestmark = pytest.mark.sentry_metrics


def PseudoProject(organization_id: int, id: int) -> Any:  # TODO: use real projects
    return types.SimpleNamespace(organization_id=organization_id, id=id, slug="project-slug")


MOCK_NOW = datetime(2021, 8, 25, 23, 59, tzinfo=timezone.utc)
# the beginning of the 1h interval before MOCK_NOW
BEG_1H_BEFORE_NOW = datetime(2021, 8, 25, 23, tzinfo=timezone.utc)
# the beginning of the 12h interval before MOCK_NOW
BEG_12H_BEFORE_NOW = datetime(2021, 8, 25, 12, tzinfo=timezone.utc)
# the beginning of the 1d interval before MOCK_NOW
BEG_1D_BEFORE_NOW = datetime(2021, 8, 25, 00, tzinfo=timezone.utc)

ORG_ID = 1
USE_CASE_ID = UseCaseID.SESSIONS


def get_entity_of_metric_mocked(_, metric_name, use_case_id):
    return {
        "sentry.sessions.session": EntityKey.MetricsCounters,
        SessionMRI.RAW_SESSION.value: EntityKey.MetricsCounters,
        "sentry.sessions.session.error": EntityKey.MetricsSets,
        SessionMRI.RAW_ERROR.value: EntityKey.MetricsSets,
    }[metric_name].value


@django_db_all
@pytest.mark.parametrize(
    "query_string,expected",
    [
        (
            'release:""',
            lambda: [
                Condition(
                    Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "release")),
                    Op.IN,
                    rhs=resolve_tag_values(USE_CASE_ID, ORG_ID, [""]),
                )
            ],
        ),
        (
            "release:myapp@2.0.0",
            lambda: [
                Condition(
                    Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "release")),
                    Op.IN,
                    rhs=resolve_tag_values(USE_CASE_ID, ORG_ID, ["myapp@2.0.0"]),
                )
            ],
        ),
        (
            "release:myapp@2.0.0 and environment:production",
            lambda: [
                And(
                    [
                        Condition(
                            Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "release")),
                            Op.IN,
                            rhs=resolve_tag_values(USE_CASE_ID, ORG_ID, ["myapp@2.0.0"]),
                        ),
                        Condition(
                            Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "environment")),
                            Op.EQ,
                            rhs=resolve_tag_value(USE_CASE_ID, ORG_ID, "production"),
                        ),
                    ]
                )
            ],
        ),
        (
            "release:myapp@2.0.0 environment:production",
            lambda: [
                Condition(
                    Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "release")),
                    Op.IN,
                    rhs=resolve_tag_values(USE_CASE_ID, ORG_ID, ["myapp@2.0.0"]),
                ),
                Condition(
                    Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "environment")),
                    Op.EQ,
                    rhs=resolve_tag_value(USE_CASE_ID, ORG_ID, "production"),
                ),
            ],
        ),
        (
            "release:myapp@2.0.0 and environment:production",
            lambda: [
                And(
                    [
                        Condition(
                            Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "release")),
                            Op.IN,
                            rhs=resolve_tag_values(USE_CASE_ID, ORG_ID, ["myapp@2.0.0"]),
                        ),
                        Condition(
                            Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "environment")),
                            Op.EQ,
                            rhs=resolve_tag_value(USE_CASE_ID, ORG_ID, "production"),
                        ),
                    ]
                ),
            ],
        ),
        (
            'transaction:"/bar/:orgId/"',
            lambda: [
                Condition(
                    Function(
                        function="transform",
                        parameters=[
                            Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "transaction")),
                            [""],
                            [resolve_tag_value(USE_CASE_ID, ORG_ID, "<< unparameterized >>")],
                        ],
                    ),
                    Op.EQ,
                    rhs=resolve_tag_value(USE_CASE_ID, ORG_ID, "/bar/:orgId/"),
                )
            ],
        ),
        (
            "release:[production,foo]",
            lambda: [
                Condition(
                    Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "release")),
                    Op.IN,
                    rhs=resolve_tag_values(USE_CASE_ID, ORG_ID, ["production", "foo"]),
                )
            ],
        ),
        (
            "!release:[production,foo]",
            lambda: [
                Condition(
                    Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "release")),
                    Op.NOT_IN,
                    rhs=resolve_tag_values(USE_CASE_ID, ORG_ID, ["production", "foo"]),
                )
            ],
        ),
        (
            "release:[foo]",
            lambda: [
                Condition(
                    Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "release")),
                    Op.IN,
                    rhs=resolve_tag_values(USE_CASE_ID, ORG_ID, ["foo"]),
                )
            ],
        ),
        (
            "release:myapp@2.0.0 or environment:[production,staging]",
            lambda: [
                Or(
                    [
                        Condition(
                            Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "release")),
                            Op.IN,
                            rhs=resolve_tag_values(USE_CASE_ID, ORG_ID, ["myapp@2.0.0"]),
                        ),
                        Condition(
                            Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "environment")),
                            Op.IN,
                            rhs=resolve_tag_values(USE_CASE_ID, ORG_ID, ["production", "staging"]),
                        ),
                    ]
                ),
            ],
        ),
    ],
)
def test_parse_conditions(query_string, expected):
    org_id = ORG_ID
    use_case_id = UseCaseID.SESSIONS
    for s in ("myapp@2.0.0", "/bar/:orgId/"):
        # will be values 10000, 10001 respectively
        indexer.record(use_case_id=UseCaseID.SESSIONS, org_id=org_id, string=s)
    parsed = resolve_tags(
        use_case_id,
        org_id,
        parse_conditions(query_string, [], []),
        [],
    )
    assert parsed == expected()


@freeze_time("2018-12-11 03:21:00")
def test_round_range():
    # since data is not exactly aligned it will return 2d + 1h (+ one interval to cover everything)
    start, end, interval = get_date_range({"statsPeriod": "2d"})
    assert start == datetime(2018, 12, 9, 3, tzinfo=timezone.utc)
    assert end == datetime(2018, 12, 11, 4, tzinfo=timezone.utc)

    # since data is not exactly aligned it will return 2h + 1d (+ one interval to cover everything)
    start, end, interval = get_date_range({"statsPeriod": "2d", "interval": "1d"})
    assert start == datetime(2018, 12, 9, tzinfo=timezone.utc)
    assert end == datetime(2018, 12, 12, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    "now,interval,parameters,expected",
    [
        ("2022-10-01 09:00:00", "1h", {"timeframe": "60m"}, ("08:00:00 10-01", "09:00:00 10-01")),
        ("2022-10-01 09:20:00", "1h", {"timeframe": "60m"}, ("08:00:00 10-01", "10:00:00 10-01")),
        ("2022-10-01 09:00:00", "2h", {"timeframe": "60m"}, ("08:00:00 10-01", "10:00:00 10-01")),
        ("2022-10-01 10:00:00", "2h", {"timeframe": "60m"}, ("08:00:00 10-01", "10:00:00 10-01")),
        ("2022-10-01 09:20:00", "2h", {"timeframe": "60m"}, ("08:00:00 10-01", "10:00:00 10-01")),
        ("2022-10-01 09:00:00", "1h", {"timeframe": "14h"}, ("19:00:00 09-30", "09:00:00 10-01")),
        ("2022-10-01 09:20:00", "1h", {"timeframe": "14h"}, ("19:00:00 09-30", "10:00:00 10-01")),
        ("2022-10-01 09:00:00", "2h", {"timeframe": "14h"}, ("18:00:00 09-30", "10:00:00 10-01")),
        ("2022-10-01 10:00:00", "2h", {"timeframe": "14h"}, ("20:00:00 09-30", "10:00:00 10-01")),
        ("2022-10-01 09:20:00", "2h", {"timeframe": "14h"}, ("18:00:00 09-30", "10:00:00 10-01")),
        ("2022-10-01 09:00:00", "1h", {"timeframe": "91d"}, ("09:00:00 07-02", "09:00:00 10-01")),
        ("2022-10-01 10:00:00", "1h", {"timeframe": "91d"}, ("10:00:00 07-02", "10:00:00 10-01")),
        ("2022-10-01 09:20:00", "1h", {"timeframe": "91d"}, ("09:00:00 07-02", "10:00:00 10-01")),
        ("2022-10-01 09:00:00", "2h", {"timeframe": "91d"}, ("08:00:00 07-02", "10:00:00 10-01")),
        ("2022-10-01 10:00:00", "2h", {"timeframe": "91d"}, ("10:00:00 07-02", "10:00:00 10-01")),
        ("2022-10-01 09:20:00", "2h", {"timeframe": "91d"}, ("08:00:00 07-02", "10:00:00 10-01")),
    ],
)
def test_get_date_range(now, interval, parameters, expected):
    def _to_datetimestring(d):
        return d.strftime("%H:%M:%S %m-%d")

    if interval is not None:
        parameters["interval"] = interval
    with freeze_time(now):
        start, end, interval = get_date_range(parameters)

        start_actual = _to_datetimestring(start)
        end_actual = _to_datetimestring(end)
        start_expected, end_expected = expected

        assert (start_actual, end_actual) == (start_expected, end_expected)


def test_invalid_interval():
    # get_date_range is now only responsible for parsing start, end and interval,
    # and not responsible for validation so just letting it bubble up the ZeroDivisionError if
    # the requested interval is 0d
    with pytest.raises(Exception):
        get_date_range({"interval": "0d"})


def test_round_exact():
    start, end, interval = get_date_range(
        {"start": "2021-01-12T04:06:16", "end": "2021-01-17T08:26:13", "interval": "1d"},
    )
    assert start == datetime(2021, 1, 12, tzinfo=timezone.utc)
    assert end == datetime(2021, 1, 18, tzinfo=timezone.utc)


def test_exclusive_end():
    start, end, interval = get_date_range(
        {"start": "2021-02-24T00:00:00", "end": "2021-02-25T00:00:00", "interval": "1h"},
    )
    assert start == datetime(2021, 2, 24, tzinfo=timezone.utc)
    assert end == datetime(2021, 2, 25, 0, tzinfo=timezone.utc)


@freeze_time("2020-12-18T11:14:17.105Z")
def test_timestamps():
    start, end, interval = get_date_range({"statsPeriod": "1d", "interval": "12h"})

    # one day before now aligned downward at 12h
    assert start == datetime(2020, 12, 17, 0, tzinfo=timezone.utc)
    # the next 12h alignment form now
    assert end == datetime(2020, 12, 18, 12, tzinfo=timezone.utc)
    assert interval == 12 * 60 * 60


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_build_snuba_query(mock_now, mock_now2):
    # Your typical release health query querying everything
    having = [Condition(Column("sum"), Op.GT, 1000)]
    query_definition = DeprecatingMetricsQuery(
        org_id=1,
        project_ids=[1],
        select=[
            MetricField("sum", SessionMRI.RAW_SESSION.value),
            MetricField("count_unique", SessionMRI.RAW_USER.value),
            MetricField("p95", SessionMRI.RAW_DURATION.value),
        ],
        start=MOCK_NOW - timedelta(days=90),
        end=MOCK_NOW,
        granularity=Granularity(3600),
        where=[Condition(Column("release"), Op.EQ, "staging")],
        groupby=[MetricGroupByField("environment")],
        having=having,
    )
    snuba_queries, _ = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition, use_case_id=UseCaseID.SESSIONS
    ).get_snuba_queries()

    org_id = 1
    use_case_id = UseCaseID.SESSIONS

    def expected_query(match, select, extra_groupby, metric_name):
        function, column, alias = select

        select_function = Function(
            OP_TO_SNUBA_FUNCTION[match][alias],
            [
                Column("value"),
                Function(
                    "equals",
                    [
                        Column("metric_id"),
                        resolve_weak(use_case_id, org_id, get_mri(metric_name)),
                    ],
                ),
            ],
        )

        if alias == "p95":
            select_function = Function(
                "arrayElement", [select_function, 1], alias=f"{alias}({metric_name})"
            )
        else:
            select_function = replace(select_function, alias=f"{alias}({metric_name})")

        return Query(
            match=Entity(match),
            select=[select_function],
            groupby=[
                AliasedExpression(
                    Column(resolve_tag_key(use_case_id, org_id, "environment")), alias="environment"
                )
            ]
            + extra_groupby,
            where=[
                Condition(Column("org_id"), Op.EQ, 1),
                Condition(Column("project_id"), Op.IN, [1]),
                Condition(Column("timestamp"), Op.GTE, MOCK_NOW - timedelta(days=90)),
                Condition(Column("timestamp"), Op.LT, MOCK_NOW),
                Condition(
                    Column(resolve_tag_key(use_case_id, org_id, "release")),
                    Op.EQ,
                    resolve_tag_value(use_case_id, org_id, "staging"),
                ),
                Condition(
                    Column("metric_id"),
                    Op.IN,
                    [resolve_weak(use_case_id, org_id, get_mri(metric_name))],
                ),
            ],
            having=having,
            # totals: MAX_POINTS // (90d * 24h)
            # series: totals * (90d * 24h)
            limit=Limit(4) if not extra_groupby else Limit(8644),
            offset=None,
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


@django_db_all
@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
@mock.patch(
    "sentry.snuba.metrics.fields.base._get_entity_of_metric_mri", get_entity_of_metric_mocked
)
def test_build_snuba_query_mri(mock_now, mock_now2):
    org_id = 1
    use_case_id = UseCaseID.SESSIONS
    # Your typical release health query querying everything
    query_params: MultiValueDict[str, str] = MultiValueDict(
        {
            "groupBy": [],
            "field": [
                "sum(c:sessions/session@none)",
            ],
            "interval": ["1d"],
            "statsPeriod": ["2d"],
        }
    )

    NUM_INTERVALS = 2 + 1  # period / interval_length + 1 ( add one for last partial interval)
    TOTALS_LIMIT = MAX_POINTS // NUM_INTERVALS
    SERIES_LIMIT = TOTALS_LIMIT * NUM_INTERVALS

    query_definition = QueryDefinition([PseudoProject(1, 1)], query_params, allow_mri=True)
    query_builder = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition.to_metrics_query(), use_case_id
    )
    snuba_queries, fields_in_entities = query_builder.get_snuba_queries()

    assert fields_in_entities == {
        "metrics_counters": [
            ("sum", SessionMRI.RAW_SESSION.value, "sum(sentry.sessions.session)"),
        ]
    }

    for key in ["totals", "series"]:
        groupby = [] if key == "totals" else [Column("bucketed_time")]
        limit = Limit(TOTALS_LIMIT) if key == "totals" else Limit(SERIES_LIMIT)

        assert snuba_queries["metrics_counters"][key] == Query(
            match=Entity("metrics_counters"),
            select=[
                Function(
                    function="sumIf",
                    parameters=[
                        Column("value"),
                        Function(
                            function="equals",
                            parameters=[
                                Column("metric_id"),
                                9223372036854775809,
                            ],
                            alias=None,
                        ),
                    ],
                    alias="sum(sentry.sessions.session)",
                )
            ],
            groupby=groupby,
            where=[
                Condition(Column("org_id"), Op.EQ, 1),
                Condition(Column("project_id"), Op.IN, [1]),
                Condition(
                    Column("timestamp"), Op.GTE, datetime(2021, 8, 23, 0, 0, tzinfo=timezone.utc)
                ),
                Condition(
                    Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, 0, tzinfo=timezone.utc)
                ),
                Condition(
                    Column("metric_id"),
                    Op.IN,
                    [resolve_weak(use_case_id, org_id, SessionMRI.RAW_SESSION.value)],
                ),
            ],
            having=[],
            limit=limit,
            offset=None,
            granularity=Granularity(query_definition.rollup),
        )


@django_db_all
@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
@mock.patch(
    "sentry.snuba.metrics.fields.base._get_entity_of_metric_mri", get_entity_of_metric_mocked
)
def test_build_snuba_query_derived_metrics(mock_now, mock_now2):
    org_id = 1
    use_case_id = UseCaseID.SESSIONS
    # Your typical release health query querying everything
    query_params: MultiValueDict[str, str] = MultiValueDict(
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

    NUM_INTERVALS = 2 + 1  # period / interval_length + 1 ( add one for last partial interval)
    TOTALS_LIMIT = MAX_POINTS // NUM_INTERVALS
    SERIES_LIMIT = TOTALS_LIMIT * NUM_INTERVALS

    query_definition = QueryDefinition([PseudoProject(1, 1)], query_params)
    query_builder = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition.to_metrics_query(), use_case_id
    )
    snuba_queries, fields_in_entities = query_builder.get_snuba_queries()
    assert fields_in_entities == {
        "metrics_counters": [
            (
                None,
                SessionMRI.ERRORED_PREAGGREGATED.value,
                f"{SessionMRI.ERRORED_PREAGGREGATED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}",
            ),
            (
                None,
                SessionMRI.CRASHED_AND_ABNORMAL.value,
                f"{SessionMRI.CRASHED_AND_ABNORMAL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}",
            ),
            (None, SessionMRI.CRASH_FREE_RATE.value, SessionMetricKey.CRASH_FREE_RATE.value),
            (None, SessionMRI.ALL.value, SessionMetricKey.ALL.value),
        ],
        "metrics_sets": [
            (
                None,
                SessionMRI.ERRORED_SET.value,
                f"{SessionMRI.ERRORED_SET.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}",
            ),
        ],
    }
    for key in ("totals", "series"):
        groupby = [] if key == "totals" else [Column("bucketed_time")]
        assert snuba_queries["metrics_counters"][key] == (
            Query(
                match=Entity("metrics_counters"),
                select=[
                    errored_preaggr_sessions(
                        org_id,
                        metric_ids=[
                            resolve_weak(use_case_id, org_id, SessionMRI.RAW_SESSION.value)
                        ],
                        alias=f"{SessionMRI.ERRORED_PREAGGREGATED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}",
                    ),
                    addition(
                        crashed_sessions(
                            org_id,
                            metric_ids=[
                                resolve_weak(use_case_id, org_id, SessionMRI.RAW_SESSION.value)
                            ],
                            alias=SessionMRI.CRASHED.value,
                        ),
                        abnormal_sessions(
                            org_id,
                            metric_ids=[
                                resolve_weak(use_case_id, org_id, SessionMRI.RAW_SESSION.value)
                            ],
                            alias=SessionMRI.ABNORMAL.value,
                        ),
                        alias=f"{SessionMRI.CRASHED_AND_ABNORMAL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}",
                    ),
                    complement(
                        division_float(
                            crashed_sessions(
                                org_id,
                                metric_ids=[
                                    resolve_weak(use_case_id, org_id, SessionMRI.RAW_SESSION.value)
                                ],
                                alias=SessionMRI.CRASHED.value,
                            ),
                            all_sessions(
                                org_id,
                                metric_ids=[
                                    resolve_weak(use_case_id, org_id, SessionMRI.RAW_SESSION.value)
                                ],
                                alias=SessionMRI.ALL.value,
                            ),
                            alias=SessionMRI.CRASH_RATE.value,
                        ),
                        alias=SessionMetricKey.CRASH_FREE_RATE.value,
                    ),
                    all_sessions(
                        org_id,
                        metric_ids=[
                            resolve_weak(use_case_id, org_id, SessionMRI.RAW_SESSION.value)
                        ],
                        alias=SessionMetricKey.ALL.value,
                    ),
                ],
                groupby=groupby,
                where=[
                    Condition(Column("org_id"), Op.EQ, 1),
                    Condition(Column("project_id"), Op.IN, [1]),
                    Condition(
                        Column("timestamp"), Op.GTE, datetime(2021, 8, 23, 0, tzinfo=timezone.utc)
                    ),
                    Condition(
                        Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=timezone.utc)
                    ),
                    Condition(
                        Column("metric_id"),
                        Op.IN,
                        [resolve_weak(use_case_id, org_id, SessionMRI.RAW_SESSION.value)],
                    ),
                ],
                having=[],
                limit=Limit(TOTALS_LIMIT) if key == "totals" else Limit(SERIES_LIMIT),
                offset=None,
                granularity=Granularity(query_definition.rollup),
            )
        )
        assert snuba_queries["metrics_sets"][key] == (
            Query(
                match=Entity("metrics_sets"),
                select=[
                    uniq_aggregation_on_metric(
                        metric_ids=[resolve_weak(use_case_id, org_id, SessionMRI.RAW_ERROR.value)],
                        alias=f"{SessionMRI.ERRORED_SET.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}",
                    ),
                ],
                groupby=groupby,
                where=[
                    Condition(Column("org_id"), Op.EQ, 1),
                    Condition(Column("project_id"), Op.IN, [1]),
                    Condition(
                        Column("timestamp"), Op.GTE, datetime(2021, 8, 23, 0, tzinfo=timezone.utc)
                    ),
                    Condition(
                        Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=timezone.utc)
                    ),
                    Condition(
                        Column("metric_id"),
                        Op.IN,
                        [resolve_weak(use_case_id, org_id, SessionMRI.RAW_ERROR.value)],
                    ),
                ],
                having=[],
                limit=Limit(TOTALS_LIMIT) if key == "totals" else Limit(SERIES_LIMIT),
                offset=None,
                granularity=Granularity(query_definition.rollup),
            )
        )


@django_db_all
@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_build_snuba_query_orderby(mock_now, mock_now2):
    query_params = MultiValueDict(
        {
            "query": [
                "release:staging"
            ],  # weird release but we need a string existing in mock indexer
            "groupBy": ["environment"],
            "field": [
                "sum(sentry.sessions.session)",
            ],
            "orderBy": ["-sum(sentry.sessions.session)"],
            "per_page": ["2"],
        }
    )
    query_definition = QueryDefinition(
        [PseudoProject(1, 1)], query_params, paginator_kwargs={"limit": 3}
    )
    snuba_queries, _ = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition.to_metrics_query(), UseCaseID.SESSIONS
    ).get_snuba_queries()

    org_id = 1
    use_case_id = UseCaseID.SESSIONS

    counter_queries = snuba_queries.pop("metrics_counters")
    assert not snuba_queries

    op = "sum"
    metric_name = "sentry.sessions.session"
    select = Function(
        OP_TO_SNUBA_FUNCTION["metrics_counters"]["sum"],
        [
            Column("value"),
            Function(
                "equals",
                [Column("metric_id"), resolve_weak(use_case_id, org_id, get_mri(metric_name))],
            ),
        ],
        alias=f"{op}({metric_name})",
    )

    assert counter_queries["totals"] == Query(
        match=Entity("metrics_counters"),
        select=[select],
        groupby=[
            AliasedExpression(
                Column(resolve_tag_key(use_case_id, org_id, "environment")), alias="environment"
            ),
        ],
        where=[
            Condition(Column("org_id"), Op.EQ, 1),
            Condition(Column("project_id"), Op.IN, [1]),
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 8, 24, 23, tzinfo=timezone.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=timezone.utc)),
            Condition(
                Column(resolve_tag_key(use_case_id, org_id, "release"), entity=None),
                Op.IN,
                resolve_tag_values(use_case_id, org_id, ["staging"]),
            ),
            Condition(
                Column("metric_id"), Op.IN, [resolve(use_case_id, org_id, get_mri(metric_name))]
            ),
        ],
        having=[],
        orderby=[OrderBy(select, Direction.DESC)],
        limit=Limit(3),
        offset=None,
        granularity=Granularity(query_definition.rollup),
    )
    assert counter_queries["series"] == Query(
        match=Entity("metrics_counters"),
        select=[select],
        groupby=[
            AliasedExpression(
                Column(resolve_tag_key(use_case_id, org_id, "environment")), alias="environment"
            ),
            Column("bucketed_time"),
        ],
        where=[
            Condition(Column("org_id"), Op.EQ, 1),
            Condition(Column("project_id"), Op.IN, [1]),
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 8, 24, 23, tzinfo=timezone.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=timezone.utc)),
            Condition(
                Column(resolve_tag_key(use_case_id, org_id, "release"), entity=None),
                Op.IN,
                resolve_tag_values(use_case_id, org_id, ["staging"]),
            ),
            Condition(
                Column("metric_id"), Op.IN, [resolve(use_case_id, org_id, get_mri(metric_name))]
            ),
        ],
        having=[],
        orderby=[OrderBy(select, Direction.DESC)],
        limit=Limit(3 * 25),  # 25 intervals so 25 times the limit for totals
        offset=None,
        granularity=Granularity(query_definition.rollup),
    )


@django_db_all
@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_build_snuba_query_with_derived_alias(mock_now, mock_now2):
    query_params = MultiValueDict(
        {
            "query": ["release:staging"],
            "groupBy": ["environment"],
            "field": [
                "p95(session.duration)",
            ],
            "per_page": ["2"],
        }
    )
    query_definition = QueryDefinition(
        [PseudoProject(1, 1)], query_params, paginator_kwargs={"limit": 3}
    )
    snuba_queries, _ = SnubaQueryBuilder(
        [PseudoProject(1, 1)],
        query_definition.to_metrics_query(),
        UseCaseID.SESSIONS,
    ).get_snuba_queries()

    org_id = 1
    use_case_id = UseCaseID.SESSIONS

    distribution_queries = snuba_queries.pop("metrics_distributions")
    assert not snuba_queries

    op = "p95"

    conditions = [
        Function(
            "equals",
            [Column("metric_id"), resolve_weak(use_case_id, org_id, SessionMRI.RAW_DURATION.value)],
        ),
        Function(
            "equals",
            (
                Column(f"tags[{resolve_weak(use_case_id, org_id, 'session.status')}]"),
                resolve_tag_value(use_case_id, org_id, "exited"),
            ),
        ),
    ]

    select = Function(
        "arrayElement",
        [
            Function(
                OP_TO_SNUBA_FUNCTION["metrics_distributions"]["p95"],
                [
                    Column("value"),
                    Function("and", conditions),
                ],
            ),
            1,
        ],
        alias=f"{op}({SessionMetricKey.DURATION.value})",
    )
    assert distribution_queries["totals"] == Query(
        match=Entity("metrics_distributions"),
        select=[select],
        groupby=[
            AliasedExpression(
                Column(resolve_tag_key(use_case_id, org_id, "environment")), alias="environment"
            ),
        ],
        where=[
            Condition(Column("org_id"), Op.EQ, 1),
            Condition(Column("project_id"), Op.IN, [1]),
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 8, 24, 23, tzinfo=timezone.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=timezone.utc)),
            Condition(
                Column(resolve_tag_key(use_case_id, org_id, "release"), entity=None),
                Op.IN,
                resolve_tag_values(use_case_id, org_id, ["staging"]),
            ),
            Condition(
                Column("metric_id"),
                Op.IN,
                [resolve(use_case_id, org_id, SessionMRI.RAW_DURATION.value)],
            ),
        ],
        having=[],
        limit=Limit(3),
        offset=None,
        granularity=Granularity(query_definition.rollup),
    )
    assert distribution_queries["series"] == Query(
        match=Entity("metrics_distributions"),
        select=[select],
        groupby=[
            AliasedExpression(
                Column(resolve_tag_key(use_case_id, org_id, "environment")), alias="environment"
            ),
            Column("bucketed_time"),
        ],
        where=[
            Condition(Column("org_id"), Op.EQ, 1),
            Condition(Column("project_id"), Op.IN, [1]),
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 8, 24, 23, tzinfo=timezone.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=timezone.utc)),
            Condition(
                Column(resolve_tag_key(use_case_id, org_id, "release"), entity=None),
                Op.IN,
                resolve_tag_values(use_case_id, org_id, ["staging"]),
            ),
            Condition(
                Column("metric_id"),
                Op.IN,
                [resolve(use_case_id, org_id, SessionMRI.RAW_DURATION.value)],
            ),
        ],
        having=[],
        limit=Limit(3 * 25),  # 25 intervals so 25 * limit for totals
        offset=None,
        granularity=Granularity(query_definition.rollup),
    )


@django_db_all
@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_translate_results_derived_metrics(_1, _2):
    query_params: MultiValueDict[str, str] = MultiValueDict(
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
    query_definition = QueryDefinition([PseudoProject(1, 1)], query_params)
    fields_in_entities = {
        "metrics_counters": [
            (
                None,
                SessionMRI.ERRORED_PREAGGREGATED.value,
                f"{SessionMRI.ERRORED_PREAGGREGATED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}",
            ),
            (
                None,
                SessionMRI.CRASHED_AND_ABNORMAL.value,
                f"{SessionMRI.CRASHED_AND_ABNORMAL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}",
            ),
            (None, SessionMRI.CRASH_FREE_RATE.value, SessionMetricKey.CRASH_FREE_RATE.value),
            (None, SessionMRI.ALL.value, SessionMetricKey.ALL.value),
        ],
        "metrics_sets": [
            (
                None,
                SessionMRI.ERRORED_SET.value,
                f"{SessionMRI.ERRORED_SET.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}",
            ),
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
                        SessionMetricKey.CRASH_FREE_RATE.value: 0.5,
                        SessionMetricKey.ALL.value: 8.0,
                        f"{SessionMRI.ERRORED_PREAGGREGATED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}": 3,
                        f"{SessionMRI.CRASHED_AND_ABNORMAL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}": 0,
                    }
                ],
            },
            "series": {
                "data": [
                    {
                        "bucketed_time": "2021-08-24T00:00Z",
                        SessionMetricKey.CRASH_FREE_RATE.value: 0.5,
                        SessionMetricKey.ALL.value: 4,
                        f"{SessionMRI.ERRORED_PREAGGREGATED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}": 1,
                        f"{SessionMRI.CRASHED_AND_ABNORMAL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}": 0,
                    },
                    {
                        "bucketed_time": "2021-08-25T00:00Z",
                        SessionMetricKey.CRASH_FREE_RATE.value: 0.5,
                        SessionMetricKey.ALL.value: 4,
                        f"{SessionMRI.ERRORED_PREAGGREGATED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}": 2,
                        f"{SessionMRI.CRASHED_AND_ABNORMAL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}": 0,
                    },
                ],
            },
        },
        "metrics_sets": {
            "totals": {
                "data": [
                    {
                        f"{SessionMRI.ERRORED_SET.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}": 3,
                    },
                ],
            },
            "series": {
                "data": [
                    {
                        "bucketed_time": "2021-08-24T00:00Z",
                        f"{SessionMRI.ERRORED_SET.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}": 2,
                    },
                    {
                        "bucketed_time": "2021-08-25T00:00Z",
                        f"{SessionMRI.ERRORED_SET.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}": 1,
                    },
                ],
            },
        },
    }

    assert SnubaResultConverter(
        1,
        query_definition.to_metrics_query(),
        fields_in_entities,
        intervals,
        results,
        UseCaseID.SESSIONS,
    ).translate_result_groups() == [
        {
            "by": {},
            "totals": {
                "session.all": 8.0,
                "session.crash_free_rate": 0.5,
                "session.errored": 6,
            },
            "series": {
                "session.all": [0, 4, 4],
                "session.crash_free_rate": [None, 0.5, 0.5],
                "session.errored": [0, 3, 3],
            },
        },
    ]


@django_db_all
@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_translate_results_missing_slots(_1, _2):
    org_id = 1
    use_case_id = UseCaseID.SESSIONS
    query_params = MultiValueDict(
        {
            "field": [
                "sum(sentry.sessions.session)",
            ],
            "interval": ["1d"],
            "statsPeriod": ["3d"],
        }
    )
    query_definition = QueryDefinition([PseudoProject(1, 1)], query_params)
    fields_in_entities = {
        "metrics_counters": [
            ("sum", SessionMRI.RAW_SESSION.value, "sum(sentry.sessions.session)"),
        ],
    }

    results = {
        "metrics_counters": {
            "totals": {
                "data": [
                    {
                        "metric_id": resolve(use_case_id, org_id, SessionMRI.RAW_SESSION.value),
                        "sum(sentry.sessions.session)": 400,
                    },
                ],
            },
            "series": {
                "data": [
                    {
                        "metric_id": resolve(use_case_id, org_id, SessionMRI.RAW_SESSION.value),
                        "bucketed_time": "2021-08-23T00:00Z",
                        "sum(sentry.sessions.session)": 100,
                    },
                    # no data for 2021-08-24
                    {
                        "metric_id": resolve(use_case_id, org_id, SessionMRI.RAW_SESSION.value),
                        "bucketed_time": "2021-08-25T00:00Z",
                        "sum(sentry.sessions.session)": 300,
                    },
                ],
            },
        },
    }

    intervals = list(
        get_intervals(query_definition.start, query_definition.end, query_definition.rollup)
    )
    assert SnubaResultConverter(
        org_id,
        query_definition.to_metrics_query(),
        fields_in_entities,
        intervals,
        results,
        use_case_id,
    ).translate_result_groups() == [
        {
            "by": {},
            "totals": {
                "sum(sentry.sessions.session)": 400,
            },
            "series": {
                # No data for 2021-08-24
                "sum(sentry.sessions.session)": [0, 100, 0, 300],
            },
        },
    ]


def test_translate_meta_results():
    meta = [
        {"name": "p50(d:transactions/measurements.lcp@millisecond)", "type": "Float64"},
        {"name": "team_key_transaction", "type": "UInt8"},
        {"name": "transaction", "type": "UInt64"},
        {"name": "project_id", "type": "UInt64"},
        {"name": "metric_id", "type": "UInt64"},
        {"name": "bucketed_time", "type": "UInt64"},
        {"name": "project.id", "type": "UInt64"},
        {"name": "time", "type": "UInt64"},
    ]
    assert translate_meta_results(
        meta,
        {
            "p50(transaction.measurements.lcp)": MetricField(
                op="p50",
                metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                alias="p50(transaction.measurements.lcp)",
            ),
        },
        {
            "transaction": MetricGroupByField("transaction"),
            "team_key_transaction": MetricGroupByField(
                field=MetricField(
                    op="team_key_transaction",
                    metric_mri=TransactionMRI.DURATION.value,
                    alias="team_key_transaction",
                )
            ),
            "project.id": MetricGroupByField(field="project_id"),
            "time": MetricGroupByField(field="bucketed_time"),
        },
    ) == sorted(
        [
            {"name": "p50(transaction.measurements.lcp)", "type": "Float64"},
            {"name": "team_key_transaction", "type": "boolean"},
            {"name": "transaction", "type": "string"},
            {"name": "project_id", "type": "UInt64"},
            {"name": "metric_id", "type": "UInt64"},
            {"name": "bucketed_time", "type": "UInt64"},
            {"name": "project.id", "type": "UInt64"},
            {"name": "time", "type": "UInt64"},
        ],
        key=lambda elem: elem["name"],
    )


def test_translate_meta_results_with_duplicates():
    meta = [
        {"name": "p50(d:transactions/measurements.lcp@millisecond)", "type": "Float64"},
        {"name": "p50(d:transactions/measurements.lcp@millisecond)", "type": "Float64"},
        {"name": "transaction", "type": "UInt64"},
        {"name": "transaction", "type": "UInt64"},
        {"name": "project_id", "type": "UInt64"},
        {"name": "project_id", "type": "UInt64"},
    ]
    assert translate_meta_results(
        meta,
        {
            "p50(transaction.measurements.lcp)": MetricField(
                op="p50",
                metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                alias="p50(transaction.measurements.lcp)",
            )
        },
        {"transaction": MetricGroupByField("transaction")},
    ) == sorted(
        [
            {"name": "p50(transaction.measurements.lcp)", "type": "Float64"},
            {"name": "transaction", "type": "string"},
            {"name": "project_id", "type": "UInt64"},
        ],
        key=lambda elem: elem["name"],
    )


@mock.patch(
    "sentry.snuba.metrics.query_builder.get_metric_object_from_metric_field",
    return_value=SingularEntityDerivedMetric(
        metric_mri=TransactionMRI.FAILURE_RATE.value,
        metrics=[
            TransactionMRI.FAILURE_COUNT.value,
            TransactionMRI.ALL.value,
        ],
        unit="transactions",
        snql=lambda failure_count, tx_count, org_id, metric_ids, alias=None: division_float(
            failure_count, tx_count, alias=alias
        ),
        meta_type="ratio",
    ),
)
def test_translate_meta_result_type_singular_entity_derived_metric(_):
    meta = [
        {"name": "transaction.failure_rate", "type": "Array(Float64)"},
        {"name": "transaction", "type": "UInt64"},
        {"name": "project_id", "type": "UInt64"},
    ]
    assert translate_meta_results(
        meta,
        {
            "transaction.failure_rate": MetricField(
                op=None,
                metric_mri=TransactionMRI.FAILURE_RATE.value,
                alias="transaction.failure_rate",
            )
        },
        {"transaction": MetricGroupByField("transaction")},
    ) == sorted(
        [
            {"name": "transaction.failure_rate", "type": "ratio"},
            {"name": "transaction", "type": "string"},
            {"name": "project_id", "type": "UInt64"},
        ],
        key=lambda elem: elem["name"],
    )


@mock.patch(
    "sentry.snuba.metrics.query_builder.get_metric_object_from_metric_field",
    return_value=CompositeEntityDerivedMetric(
        metric_mri=SessionMRI.ERRORED.value,
        metrics=[
            SessionMRI.ERRORED_ALL.value,
            SessionMRI.CRASHED_AND_ABNORMAL.value,
        ],
        meta_type="sessions",
        unit="sessions",
        post_query_func=lambda errored_all, crashed_abnormal: max(
            0, errored_all - crashed_abnormal
        ),
    ),
)
def test_translate_meta_result_type_composite_entity_derived_metric(_):
    meta = [
        {
            "name": "e:sessions/all_errored@none__CHILD_OF__session.errored",
            "type": "Array(Float64)",
        },
    ]
    assert translate_meta_results(
        meta,
        {
            "session.errored": MetricField(
                op=None,
                metric_mri=SessionMRI.ERRORED.value,
                alias="session.errored",
            )
        },
        {},
    ) == sorted(
        [
            {"name": "session.errored", "type": "sessions"},
        ],
        key=lambda elem: elem["name"],
    )


@pytest.mark.parametrize(
    "select,groupby,usecase,error_string",
    [
        pytest.param(
            [
                MetricField("sum", SessionMRI.RAW_SESSION.value),
                MetricField("count_unique", SessionMRI.RAW_USER.value),
                MetricField("p95", SessionMRI.RAW_DURATION.value),
            ],
            [
                MetricGroupByField(MetricField("sum", SessionMRI.RAW_SESSION.value)),
            ],
            UseCaseID.SESSIONS,
            re.escape("Cannot group by metrics expression sum(sentry.sessions.session)"),
            id="invalid grouping by metric expression - release_health",
        ),
        pytest.param(
            [
                MetricField("count", TransactionMRI.DURATION.value),
            ],
            [
                MetricGroupByField(MetricField("count", TransactionMRI.DURATION.value)),
            ],
            UseCaseID.TRANSACTIONS,
            re.escape("Cannot group by metrics expression count(transaction.duration)"),
            id="invalid grouping by metric expression - performance",
        ),
        pytest.param(
            [
                MetricField(None, TransactionMRI.FAILURE_RATE.value),
            ],
            [
                MetricGroupByField(MetricField(None, TransactionMRI.FAILURE_RATE.value)),
            ],
            UseCaseID.TRANSACTIONS,
            "Cannot group by metric transaction.failure_rate",
            id="invalid grouping by derived metric - release_health",
        ),
        pytest.param(
            [
                MetricField(None, SessionMRI.ERRORED.value),
            ],
            [
                MetricGroupByField(MetricField(None, SessionMRI.ERRORED.value)),
            ],
            UseCaseID.TRANSACTIONS,
            "Cannot group by metric session.errored",
            id="invalid grouping by composite entity derived metric - release_health",
        ),
        pytest.param(
            [
                MetricField(
                    "team_key_transaction",
                    TransactionMRI.DURATION.value,
                    params={"team_key_condition_rhs": [(1, "foo")]},
                ),
            ],
            [
                MetricGroupByField(
                    MetricField(
                        "team_key_transaction",
                        TransactionMRI.DURATION.value,
                        params={"team_key_condition_rhs": [(1, "foo")]},
                    )
                ),
            ],
            UseCaseID.TRANSACTIONS,
            "",
            id="valid grouping by metrics expression",
        ),
    ],
)
def test_only_can_groupby_operations_can_be_added_to_groupby(
    select, groupby, usecase, error_string
):
    query_definition = DeprecatingMetricsQuery(
        org_id=1,
        project_ids=[1],
        select=select,
        start=MOCK_NOW - timedelta(days=90),
        end=MOCK_NOW,
        granularity=Granularity(3600),
        groupby=groupby,
    )
    if error_string:
        with pytest.raises(InvalidParams, match=error_string):
            snuba_queries, _ = SnubaQueryBuilder(
                [PseudoProject(1, 1)], query_definition, use_case_id=usecase
            ).get_snuba_queries()
    else:
        snuba_queries, _ = SnubaQueryBuilder(
            [PseudoProject(1, 1)], query_definition, use_case_id=usecase
        ).get_snuba_queries()


@pytest.mark.parametrize(
    "select,where,usecase,error_string",
    [
        pytest.param(
            [
                MetricField("sum", SessionMRI.RAW_SESSION.value),
                MetricField("count_unique", SessionMRI.RAW_USER.value),
                MetricField("p95", SessionMRI.RAW_DURATION.value),
            ],
            [
                MetricConditionField(MetricField("sum", SessionMRI.RAW_SESSION.value), Op.GTE, 10),
            ],
            UseCaseID.SESSIONS,
            re.escape("Cannot filter by metrics expression sum(sentry.sessions.session)"),
            id="invalid filtering by metric expression - release_health",
        ),
        pytest.param(
            [
                MetricField("count", TransactionMRI.DURATION.value),
            ],
            [
                MetricConditionField(MetricField("count", TransactionMRI.DURATION.value), Op.LT, 2),
            ],
            UseCaseID.TRANSACTIONS,
            re.escape("Cannot filter by metrics expression count(transaction.duration)"),
            id="invalid filtering by metric expression - performance",
        ),
        pytest.param(
            [
                MetricField(None, TransactionMRI.FAILURE_RATE.value),
            ],
            [
                MetricConditionField(
                    MetricField(None, TransactionMRI.FAILURE_RATE.value), Op.EQ, 0.5
                ),
            ],
            UseCaseID.TRANSACTIONS,
            "Cannot filter by metric transaction.failure_rate",
            id="invalid filtering by derived metric - release_health",
        ),
        pytest.param(
            [
                MetricField(None, SessionMRI.ERRORED.value),
            ],
            [
                MetricConditionField(MetricField(None, SessionMRI.ERRORED.value), Op.EQ, 7),
            ],
            UseCaseID.TRANSACTIONS,
            "Cannot filter by metric session.errored",
            id="invalid filtering by composite entity derived metric - release_health",
        ),
        pytest.param(
            [
                MetricField(
                    "team_key_transaction",
                    TransactionMRI.DURATION.value,
                    params={"team_key_condition_rhs": [(1, "foo")]},
                ),
            ],
            [
                MetricConditionField(
                    MetricField(
                        "team_key_transaction",
                        TransactionMRI.DURATION.value,
                        params={"team_key_condition_rhs": [(1, "foo")]},
                    ),
                    Op.EQ,
                    1,
                ),
            ],
            UseCaseID.TRANSACTIONS,
            "",
            id="valid filtering by metrics expression",
        ),
    ],
)
def test_only_can_filter_operations_can_be_added_to_where(select, where, usecase, error_string):
    query_definition = DeprecatingMetricsQuery(
        org_id=1,
        project_ids=[1],
        select=select,
        start=MOCK_NOW - timedelta(days=90),
        end=MOCK_NOW,
        granularity=Granularity(3600),
        where=where,
    )
    if error_string:
        with pytest.raises(InvalidParams, match=error_string):
            snuba_queries, _ = SnubaQueryBuilder(
                [PseudoProject(1, 1)], query_definition, use_case_id=usecase
            ).get_snuba_queries()
    else:
        snuba_queries, _ = SnubaQueryBuilder(
            [PseudoProject(1, 1)], query_definition, use_case_id=usecase
        ).get_snuba_queries()


class QueryDefinitionTestCase(TestCase):
    def test_valid_latest_release_alias_filter(self):
        self.create_release(version="foo", project=self.project, date_added=before_now(days=4))
        self.create_release(
            version="bar", project=self.project, date_added=before_now(days=2)
        )  # latest release

        query_params = MultiValueDict(
            {
                "query": ["release:latest"],
                "field": [
                    "sum(sentry.sessions.session)",
                ],
            }
        )
        query = QueryDefinition([self.project], query_params)
        assert query.where == [
            Condition(
                Column(name="release"),
                Op.IN,
                rhs=["bar"],
            )
        ]

    def test_single_environment_is_passed_through_to_metrics_query(self):
        self.create_environment(name="alpha", project=self.project)
        query_params = MultiValueDict(
            {
                "environment": ["alpha"],
                "query": [""],
                "field": [
                    "sum(sentry.sessions.session)",
                ],
            }
        )
        query = QueryDefinition([self.project], query_params)
        actual_result = query.to_metrics_query()
        assert actual_result.where == [
            Condition(
                Column(name="environment"),
                Op.EQ,
                rhs="alpha",
            )
        ]

    def test_multiple_environments_are_passed_through_to_metrics_query(self):
        self.create_environment(name="alpha", project=self.project)
        self.create_environment(name="beta", project=self.project)
        query_params = MultiValueDict(
            {
                "environment": ["alpha", "beta"],
                "query": [""],
                "field": [
                    "sum(sentry.sessions.session)",
                ],
            }
        )
        query = QueryDefinition([self.project], query_params)
        actual_result = query.to_metrics_query()
        assert actual_result.where == [
            Condition(
                Column(name="environment"),
                Op.IN,
                rhs=["alpha", "beta"],
            )
        ]


class ResolveTagsTestCase(TestCase):
    def setUp(self):
        self.org_id = ORG_ID
        self.use_case_id = UseCaseID.TRANSACTIONS

    def test_resolve_tags_with_unary_tuple(self):
        transactions = ["/foo", "/bar"]

        for transaction in ["transaction"] + transactions:
            indexer.record(
                use_case_id=self.use_case_id,
                org_id=self.org_id,
                string=transaction,
            )

        resolved_query = resolve_tags(
            self.use_case_id,
            self.org_id,
            Condition(
                lhs=Function(
                    function="tuple",
                    parameters=[
                        Column(
                            name="tags[transaction]",
                        )
                    ],
                ),
                op=Op.IN,
                rhs=Function(
                    function="tuple",
                    parameters=[(transaction,) for transaction in transactions],
                ),
            ),
            [],
        )

        assert resolved_query == Condition(
            lhs=Function(
                function="tuple",
                parameters=[
                    Function(
                        function="transform",
                        parameters=[
                            Column(
                                name=resolve_tag_key(self.use_case_id, self.org_id, "transaction")
                            ),
                            [""],
                            [
                                resolve_tag_value(
                                    self.use_case_id, self.org_id, "<< unparameterized >>"
                                )
                            ],
                        ],
                    )
                ],
            ),
            op=Op.IN,
            rhs=Function(
                function="tuple",
                parameters=[
                    (resolve_tag_value(self.use_case_id, self.org_id, transaction),)
                    for transaction in transactions
                ],
            ),
        )

    def test_resolve_tags_with_binary_tuple(self):
        tags = [("/foo", "ios"), ("/bar", "android")]

        for transaction, platform in [("transaction", "platform")] + tags:
            indexer.record(
                use_case_id=self.use_case_id,
                org_id=self.org_id,
                string=transaction,
            )
            indexer.record(
                use_case_id=self.use_case_id,
                org_id=self.org_id,
                string=platform,
            )

        resolved_query = resolve_tags(
            self.use_case_id,
            self.org_id,
            Condition(
                lhs=Function(
                    function="tuple",
                    parameters=[
                        Column(
                            name="tags[transaction]",
                        ),
                        Column(
                            name="tags[platform]",
                        ),
                    ],
                ),
                op=Op.IN,
                rhs=Function(
                    function="tuple",
                    parameters=[(transaction, platform) for transaction, platform in tags],
                ),
            ),
            [],
        )

        assert resolved_query == Condition(
            lhs=Function(
                function="tuple",
                parameters=[
                    Function(
                        function="transform",
                        parameters=[
                            Column(
                                name=resolve_tag_key(self.use_case_id, self.org_id, "transaction")
                            ),
                            [""],
                            [
                                resolve_tag_value(
                                    self.use_case_id, self.org_id, "<< unparameterized >>"
                                )
                            ],
                        ],
                    ),
                    Column(
                        name=resolve_tag_key(self.use_case_id, self.org_id, "platform"),
                    ),
                ],
            ),
            op=Op.IN,
            rhs=Function(
                function="tuple",
                parameters=[
                    (
                        resolve_tag_value(self.use_case_id, self.org_id, transaction),
                        resolve_tag_value(self.use_case_id, self.org_id, platform),
                    )
                    for transaction, platform in tags
                ],
            ),
        )

    def test_resolve_tags_with_has(self):
        tag_key = "transaction"

        indexer.record(
            use_case_id=self.use_case_id,
            org_id=self.org_id,
            string=tag_key,
        )

        resolved_query = resolve_tags(
            self.use_case_id,
            self.org_id,
            Condition(
                lhs=Function(
                    function="has",
                    parameters=[
                        Column(
                            name="tags.key",
                        ),
                        "transaction",
                    ],
                ),
                op=Op.EQ,
                rhs=1,
            ),
            [],
        )

        assert resolved_query == Condition(
            lhs=Function(
                function="has",
                parameters=[
                    Column(
                        name="tags.key",
                    ),
                    resolve_weak(self.use_case_id, self.org_id, tag_key),
                ],
            ),
            op=Op.EQ,
            rhs=1,
        )

    def test_resolve_tags_with_match_and_filterable_tag(self):
        indexer.record(
            use_case_id=self.use_case_id,
            org_id=self.org_id,
            string="environment",
        )

        resolved_query = resolve_tags(
            self.use_case_id,
            self.org_id,
            Condition(
                lhs=Function(
                    function="match",
                    parameters=[
                        Column(
                            name="tags[environment]",
                        ),
                        "*ev",
                    ],
                ),
                op=Op.EQ,
                rhs=1,
            ),
            [],
        )

        assert resolved_query == Condition(
            lhs=Function(
                function="match",
                parameters=[
                    Column(
                        name=resolve_tag_key(self.use_case_id, self.org_id, "environment"),
                    ),
                    "*ev",
                ],
            ),
            op=Op.EQ,
            rhs=1,
        )

    def test_resolve_tags_with_match_and_deep_filterable_tag(self):
        indexer.record(
            use_case_id=self.use_case_id,
            org_id=self.org_id,
            string="environment",
        )

        resolved_query = resolve_tags(
            self.use_case_id,
            self.org_id,
            Condition(
                lhs=Function(
                    function="match",
                    parameters=[
                        Function(
                            "ifNull",
                            parameters=[
                                Column(
                                    name="tags[environment]",
                                ),
                            ],
                        ),
                        "*ev",
                    ],
                ),
                op=Op.EQ,
                rhs=1,
            ),
            [],
        )

        assert resolved_query == Condition(
            lhs=Function(
                function="match",
                parameters=[
                    Column(
                        name=resolve_tag_key(self.use_case_id, self.org_id, "environment"),
                    ),
                    "*ev",
                ],
            ),
            op=Op.EQ,
            rhs=1,
        )

    def test_resolve_tags_with_match_and_non_filterable_tag(self):
        indexer.record(
            use_case_id=self.use_case_id,
            org_id=self.org_id,
            string="http_status_code",
        )

        with pytest.raises(
            InvalidParams,
            match="The tag key http_status_code usage has been prohibited by one of the "
            "expressions {'match'}",
        ):
            resolve_tags(
                self.use_case_id,
                self.org_id,
                Condition(
                    lhs=Function(
                        function="match",
                        parameters=[
                            Column(
                                name="tags[http_status_code]",
                            ),
                            "2**",
                        ],
                    ),
                    op=Op.EQ,
                    rhs=1,
                ),
                [],
            )

    def test_resolve_tags_with_match_and_deep_non_filterable_tag(self):
        indexer.record(
            use_case_id=self.use_case_id,
            org_id=self.org_id,
            string="http_status_code",
        )

        with pytest.raises(
            InvalidParams,
            match="The tag key http_status_code usage has been prohibited by one of the "
            "expressions {'match'}",
        ):
            resolve_tags(
                self.use_case_id,
                self.org_id,
                Condition(
                    lhs=Function(
                        function="match",
                        parameters=[
                            Function(
                                "ifNull",
                                parameters=[
                                    Column(
                                        name="tags[http_status_code]",
                                    )
                                ],
                            ),
                            "2**",
                        ],
                    ),
                    op=Op.EQ,
                    rhs=1,
                ),
                [],
            )

    @mock.patch(
        "sentry.snuba.metrics.Project.objects.filter",
        return_value=[PseudoProject(i, ORG_ID) for i in range(QUERY_PROJECT_LIMIT + 1)],
    )
    def test_resolve_tags_too_many_projects(self, projects):
        with mock.patch.object(sentry_sdk, "capture_message") as capture_message:
            resolve_tags(
                self.use_case_id,
                self.org_id,
                Condition(
                    lhs=Function(
                        function="ifNull",
                        parameters=[
                            Column(
                                name="tags[project]",
                            ),
                            "transaction",
                        ],
                    ),
                    op=Op.EQ,
                    rhs=["project-slug"],
                ),
                [PseudoProject(1, ORG_ID)],
            )

        assert capture_message.call_count == 1

    @mock.patch(
        "sentry.snuba.metrics.Project.objects.filter", return_value=[PseudoProject(1, ORG_ID)]
    )
    def test_resolve_tags_invalid_project_slugs(self, projects):
        with pytest.raises(InvalidParams):
            resolve_tags(
                self.use_case_id,
                self.org_id,
                Condition(
                    lhs=Function(
                        function="ifNull",
                        parameters=[
                            Column(
                                name="tags[project]",
                            ),
                            "transaction",
                        ],
                    ),
                    op=Op.EQ,
                    rhs=["invalid-project-slug"],
                ),
                [],
            )


@pytest.mark.parametrize(
    "op, clickhouse_op",
    [
        ("min_timestamp", "minIf"),
        ("max_timestamp", "maxIf"),
    ],
)
def test_timestamp_operators(op: MetricOperationType, clickhouse_op: str):
    """
    Tests code generation for timestamp operators
    """
    org_id = 1
    query_definition = DeprecatingMetricsQuery(
        org_id=org_id,
        project_ids=[1],
        select=[
            MetricField(op=op, metric_mri=SessionMRI.RAW_SESSION.value, alias="ts"),
        ],
        start=MOCK_NOW - timedelta(days=90),
        end=MOCK_NOW,
        granularity=Granularity(3600),
    )

    builder = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition, use_case_id=UseCaseID.SESSIONS
    )

    snuba_queries, fields = builder.get_snuba_queries()
    select = snuba_queries["metrics_counters"]["totals"].select
    assert len(select) == 1
    field = select[0]

    expected_field = Function(
        clickhouse_op,
        [
            Column("timestamp"),
            Function(
                "equals",
                [
                    Column("metric_id"),
                    resolve_weak(UseCaseID.SESSIONS, org_id, SessionMRI.RAW_SESSION.value),
                ],
            ),
        ],
        alias="ts",
    )

    assert field == expected_field


@pytest.mark.parametrize(
    "include_totals, include_series",
    [
        [True, False],
        [True, True],
        [False, True],
    ],
)
def test_having_clause(include_totals, include_series):
    """
    Tests that the having clause ends up in the snql queries in the expected form
    """
    having = [Condition(Column("sum"), Op.GT, 1000)]

    query_definition = DeprecatingMetricsQuery(
        org_id=1,
        project_ids=[1],
        select=[
            MetricField("sum", SessionMRI.RAW_SESSION.value, alias="sum"),
        ],
        start=MOCK_NOW - timedelta(days=90),
        end=MOCK_NOW,
        granularity=Granularity(3600),
        groupby=[MetricGroupByField("environment")],
        having=having,
        include_totals=include_totals,
        include_series=include_series,
    )
    snuba_queries, _ = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition, use_case_id=UseCaseID.SESSIONS
    ).get_snuba_queries()

    queries = snuba_queries["metrics_counters"]
    if include_totals:
        query = queries["totals"]
        assert query.having == having
    if include_series:
        query = queries["series"]
        assert query.having == having
