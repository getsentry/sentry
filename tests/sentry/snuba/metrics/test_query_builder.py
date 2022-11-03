import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from unittest import mock

import pytest
import pytz
from django.utils.datastructures import MultiValueDict
from freezegun import freeze_time
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
    Offset,
    Op,
    Or,
    OrderBy,
    Query,
)

from sentry.api.utils import InvalidParams
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
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
    MetricsQuery,
    SnubaQueryBuilder,
    SnubaResultConverter,
    get_date_range,
    get_intervals,
    parse_query,
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
from sentry.snuba.metrics.query_builder import QueryDefinition
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics


@dataclass
class PseudoProject:
    organization_id: int
    id: int


MOCK_NOW = datetime(2021, 8, 25, 23, 59, tzinfo=pytz.utc)
ORG_ID = 1
USE_CASE_ID = UseCaseKey.RELEASE_HEALTH


def get_entity_of_metric_mocked(_, metric_name, use_case_id):
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
                    Column(name=resolve_tag_key(USE_CASE_ID, ORG_ID, "transaction")),
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
def test_parse_query(query_string, expected):
    org_id = ORG_ID
    use_case_id = UseCaseKey.RELEASE_HEALTH
    for s in ("myapp@2.0.0", "/bar/:orgId/"):
        # will be values 10000, 10001 respectively
        indexer.record(use_case_id=use_case_id, org_id=org_id, string=s)
    parsed = resolve_tags(
        use_case_id,
        org_id,
        parse_query(query_string, []),
    )
    assert parsed == expected()


@freeze_time("2018-12-11 03:21:00")
def test_round_range():
    start, end, interval = get_date_range({"statsPeriod": "2d"})
    assert start == datetime(2018, 12, 9, 4, tzinfo=pytz.utc)
    assert end == datetime(2018, 12, 11, 4, tzinfo=pytz.utc)

    start, end, interval = get_date_range({"statsPeriod": "2d", "interval": "1d"})
    assert start == datetime(2018, 12, 10, tzinfo=pytz.utc)
    assert end == datetime(2018, 12, 12, 0, 0, tzinfo=pytz.utc)


def test_invalid_interval():
    # get_date_range is now only responsible for parsing start, end and interval,
    # and not responsible for validation so just letting it bubble up the ZeroDivisionError if
    # the requested interval is 0d
    with pytest.raises(ZeroDivisionError):
        get_date_range({"interval": "0d"})


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


@freeze_time("2020-12-18T11:14:17.105Z")
def test_timestamps():
    start, end, interval = get_date_range({"statsPeriod": "1d", "interval": "12h"})
    assert start == datetime(2020, 12, 17, 12, tzinfo=pytz.utc)
    assert end == datetime(2020, 12, 18, 12, tzinfo=pytz.utc)
    assert interval == 12 * 60 * 60


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_build_snuba_query(mock_now, mock_now2):
    # Your typical release health query querying everything
    query_definition = MetricsQuery(
        org_id=1,
        project_ids=[1],
        select=[
            MetricField("sum", SessionMRI.SESSION.value),
            MetricField("count_unique", SessionMRI.USER.value),
            MetricField("p95", SessionMRI.RAW_DURATION.value),
        ],
        start=MOCK_NOW - timedelta(days=90),
        end=MOCK_NOW,
        granularity=Granularity(3600),
        where=[Condition(Column("release"), Op.EQ, "staging")],
        groupby=[MetricGroupByField("environment")],
    )
    snuba_queries, _ = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition, use_case_id=UseCaseKey.RELEASE_HEALTH
    ).get_snuba_queries()

    org_id = 1
    use_case_id = UseCaseKey.RELEASE_HEALTH

    def expected_query(match, select, extra_groupby, metric_name):
        function, column, alias = select
        return Query(
            match=Entity(match),
            select=[
                Function(
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
                    alias=f"{alias}({metric_name})",
                )
            ],
            groupby=[
                AliasedExpression(
                    Column(resolve_tag_key(use_case_id, org_id, "environment")), alias="environment"
                )
            ]
            + extra_groupby,
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
            # totals: MAX_POINTS // (90d * 24h)
            # series: totals * (90d * 24h)
            limit=Limit(4) if not extra_groupby else Limit(8640),
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
def test_build_snuba_query_derived_metrics(mock_now, mock_now2):
    org_id = 1
    use_case_id = UseCaseKey.RELEASE_HEALTH
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
                        metric_ids=[resolve_weak(use_case_id, org_id, SessionMRI.SESSION.value)],
                        alias=f"{SessionMRI.ERRORED_PREAGGREGATED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}",
                    ),
                    addition(
                        crashed_sessions(
                            org_id,
                            metric_ids=[
                                resolve_weak(use_case_id, org_id, SessionMRI.SESSION.value)
                            ],
                            alias=SessionMRI.CRASHED.value,
                        ),
                        abnormal_sessions(
                            org_id,
                            metric_ids=[
                                resolve_weak(use_case_id, org_id, SessionMRI.SESSION.value)
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
                                    resolve_weak(use_case_id, org_id, SessionMRI.SESSION.value)
                                ],
                                alias=SessionMRI.CRASHED.value,
                            ),
                            all_sessions(
                                org_id,
                                metric_ids=[
                                    resolve_weak(use_case_id, org_id, SessionMRI.SESSION.value)
                                ],
                                alias=SessionMRI.ALL.value,
                            ),
                            alias=SessionMRI.CRASH_RATE.value,
                        ),
                        alias=SessionMetricKey.CRASH_FREE_RATE.value,
                    ),
                    all_sessions(
                        org_id,
                        metric_ids=[resolve_weak(use_case_id, org_id, SessionMRI.SESSION.value)],
                        alias=SessionMetricKey.ALL.value,
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
                        [resolve_weak(use_case_id, org_id, SessionMRI.SESSION.value)],
                    ),
                ],
                limit=Limit(MAX_POINTS // 2) if key == "totals" else Limit(MAX_POINTS),
                offset=Offset(0),
                granularity=Granularity(query_definition.rollup),
            )
        )
        assert snuba_queries["metrics_sets"][key] == (
            Query(
                match=Entity("metrics_sets"),
                select=[
                    uniq_aggregation_on_metric(
                        metric_ids=[resolve_weak(use_case_id, org_id, SessionMRI.ERROR.value)],
                        alias=f"{SessionMRI.ERRORED_SET.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{SessionMetricKey.ERRORED.value}",
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
                        [resolve_weak(use_case_id, org_id, SessionMRI.ERROR.value)],
                    ),
                ],
                limit=Limit(MAX_POINTS // 2) if key == "totals" else Limit(MAX_POINTS),
                offset=Offset(0),
                granularity=Granularity(query_definition.rollup),
            )
        )


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
            "per_page": [2],
        }
    )
    query_definition = QueryDefinition(
        [PseudoProject(1, 1)], query_params, paginator_kwargs={"limit": 3}
    )
    snuba_queries, _ = SnubaQueryBuilder(
        [PseudoProject(1, 1)], query_definition.to_metrics_query(), UseCaseKey.RELEASE_HEALTH
    ).get_snuba_queries()

    org_id = 1
    use_case_id = UseCaseKey.RELEASE_HEALTH

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
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 8, 25, 0, tzinfo=pytz.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
            Condition(
                Column(resolve_tag_key(use_case_id, org_id, "release"), entity=None),
                Op.IN,
                resolve_tag_values(use_case_id, org_id, ["staging"]),
            ),
            Condition(
                Column("metric_id"), Op.IN, [resolve(use_case_id, org_id, get_mri(metric_name))]
            ),
        ],
        orderby=[OrderBy(select, Direction.DESC)],
        limit=Limit(3),
        offset=Offset(0),
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
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 8, 25, 0, tzinfo=pytz.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
            Condition(
                Column(resolve_tag_key(use_case_id, org_id, "release"), entity=None),
                Op.IN,
                resolve_tag_values(use_case_id, org_id, ["staging"]),
            ),
            Condition(
                Column("metric_id"), Op.IN, [resolve(use_case_id, org_id, get_mri(metric_name))]
            ),
        ],
        orderby=[OrderBy(select, Direction.DESC)],
        limit=Limit(72),
        offset=Offset(0),
        granularity=Granularity(query_definition.rollup),
    )


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
            "per_page": [2],
        }
    )
    query_definition = QueryDefinition(
        [PseudoProject(1, 1)], query_params, paginator_kwargs={"limit": 3}
    )
    snuba_queries, _ = SnubaQueryBuilder(
        [PseudoProject(1, 1)],
        query_definition.to_metrics_query(),
        UseCaseKey.RELEASE_HEALTH,
    ).get_snuba_queries()

    org_id = 1
    use_case_id = UseCaseKey.RELEASE_HEALTH

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
        OP_TO_SNUBA_FUNCTION["metrics_distributions"]["p95"],
        [
            Column("value"),
            Function("and", conditions),
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
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 8, 25, 0, tzinfo=pytz.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
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
        limit=Limit(3),
        offset=Offset(0),
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
            Condition(Column("timestamp"), Op.GTE, datetime(2021, 8, 25, 0, tzinfo=pytz.utc)),
            Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 26, 0, tzinfo=pytz.utc)),
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
        limit=Limit(72),
        offset=Offset(0),
        granularity=Granularity(query_definition.rollup),
    )


@mock.patch("sentry.snuba.sessions_v2.get_now", return_value=MOCK_NOW)
@mock.patch("sentry.api.utils.timezone.now", return_value=MOCK_NOW)
def test_translate_results_derived_metrics(_1, _2):
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
        UseCaseKey.RELEASE_HEALTH,
    ).translate_result_groups() == [
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
def test_translate_results_missing_slots(_1, _2):
    org_id = 1
    use_case_id = UseCaseKey.RELEASE_HEALTH
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
            ("sum", SessionMRI.SESSION.value, "sum(sentry.sessions.session)"),
        ],
    }

    results = {
        "metrics_counters": {
            "totals": {
                "data": [
                    {
                        "metric_id": resolve(use_case_id, org_id, SessionMRI.SESSION.value),
                        "sum(sentry.sessions.session)": 400,
                    },
                ],
            },
            "series": {
                "data": [
                    {
                        "metric_id": resolve(use_case_id, org_id, SessionMRI.SESSION.value),
                        "bucketed_time": "2021-08-23T00:00Z",
                        "sum(sentry.sessions.session)": 100,
                    },
                    # no data for 2021-08-24
                    {
                        "metric_id": resolve(use_case_id, org_id, SessionMRI.SESSION.value),
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
                "sum(sentry.sessions.session)": [100, 0, 300],
            },
        },
    ]


def test_get_intervals():
    with pytest.raises(AssertionError):
        list(get_intervals(MOCK_NOW - timedelta(days=1), MOCK_NOW, -3600))


def test_translate_meta_results():
    meta = [
        {"name": "p50(d:transactions/measurements.lcp@millisecond)", "type": "Float64"},
        {"name": "team_key_transaction", "type": "UInt8"},
        {"name": "transaction", "type": "UInt64"},
        {"name": "project_id", "type": "UInt64"},
        {"name": "metric_id", "type": "UInt64"},
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
        },
    ) == sorted(
        [
            {"name": "p50(transaction.measurements.lcp)", "type": "Float64"},
            {"name": "team_key_transaction", "type": "boolean"},
            {"name": "transaction", "type": "string"},
            {"name": "project_id", "type": "UInt64"},
            {"name": "metric_id", "type": "UInt64"},
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
                MetricField("sum", SessionMRI.SESSION.value),
                MetricField("count_unique", SessionMRI.USER.value),
                MetricField("p95", SessionMRI.RAW_DURATION.value),
            ],
            [
                MetricGroupByField(MetricField("sum", SessionMRI.SESSION.value)),
            ],
            UseCaseKey.RELEASE_HEALTH,
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
            UseCaseKey.PERFORMANCE,
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
            UseCaseKey.PERFORMANCE,
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
            UseCaseKey.PERFORMANCE,
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
            UseCaseKey.PERFORMANCE,
            "",
            id="valid grouping by metrics expression",
        ),
    ],
)
def test_only_can_groupby_operations_can_be_added_to_groupby(
    select, groupby, usecase, error_string
):
    query_definition = MetricsQuery(
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
                MetricField("sum", SessionMRI.SESSION.value),
                MetricField("count_unique", SessionMRI.USER.value),
                MetricField("p95", SessionMRI.RAW_DURATION.value),
            ],
            [
                MetricConditionField(MetricField("sum", SessionMRI.SESSION.value), Op.GTE, 10),
            ],
            UseCaseKey.RELEASE_HEALTH,
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
            UseCaseKey.PERFORMANCE,
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
            UseCaseKey.PERFORMANCE,
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
            UseCaseKey.PERFORMANCE,
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
            UseCaseKey.PERFORMANCE,
            "",
            id="valid filtering by metrics expression",
        ),
    ],
)
def test_only_can_filter_operations_can_be_added_to_where(select, where, usecase, error_string):
    query_definition = MetricsQuery(
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
        assert query.parsed_query == [
            Condition(
                Column(name="release"),
                Op.IN,
                rhs=["bar"],
            )
        ]


class ResolveTagsTestCase(TestCase):
    def setUp(self):
        self.org_id = ORG_ID
        self.use_case_id = UseCaseKey.PERFORMANCE

    def test_resolve_tags_with_unary_tuple(self):
        transactions = ["/foo", "/bar"]

        for transaction in ["transaction"] + transactions:
            indexer.record(use_case_id=self.use_case_id, org_id=self.org_id, string=transaction)

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
        )

        assert resolved_query == Condition(
            lhs=Function(
                function="tuple",
                parameters=[
                    Column(
                        name=resolve_tag_key(self.use_case_id, self.org_id, "transaction"),
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
            indexer.record(use_case_id=self.use_case_id, org_id=self.org_id, string=transaction)
            indexer.record(use_case_id=self.use_case_id, org_id=self.org_id, string=platform)

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
        )

        assert resolved_query == Condition(
            lhs=Function(
                function="tuple",
                parameters=[
                    Column(
                        name=resolve_tag_key(self.use_case_id, self.org_id, "transaction"),
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

        indexer.record(use_case_id=self.use_case_id, org_id=self.org_id, string=tag_key)

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
