import datetime

import pytest
import pytz
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity, Limit, Offset
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import Query

from sentry.snuba.metrics import MetricField, MetricsQuery
from sentry.snuba.metrics.mqb_query_transformer import tranform_mqb_query_to_metrics_query


class MetricGroupByField:
    ...


# ToDo Test Invalid queries:= Transform Function, Tags in the select, Ordering by bucketed_time

VALID_QUERIES_INTEGRATION_TEST_CASES = [
    # Totals Query
    pytest.param(
        Query(
            match=Entity("generic_metrics_distributions"),
            select=[
                Function(
                    function="count_web_vitals_measurements",
                    initializers=None,
                    parameters=[Column("d:transactions/measurements.cls@millisecond"), "good"],
                    alias="count_web_vitals_measurements_cls_good",
                ),
                Function(
                    function="count_web_vitals_measurements",
                    initializers=None,
                    parameters=[Column("d:transactions/measurements.fid@millisecond"), "meh"],
                    alias="count_web_vitals_measurements_fid_meh",
                ),
                Function(
                    function="count_web_vitals_measurements",
                    initializers=None,
                    parameters=[Column("d:transactions/measurements.fp@millisecond"), "good"],
                    alias="count_web_vitals_measurements_fp_good",
                ),
                Function(
                    function="count_web_vitals_measurements",
                    initializers=None,
                    parameters=[Column("d:transactions/measurements.lcp@millisecond"), "good"],
                    alias="count_web_vitals_measurements_lcp_good",
                ),
                Function(
                    function="count_web_vitals_measurements",
                    initializers=None,
                    parameters=[Column("d:transactions/measurements.fcp@millisecond"), "meh"],
                    alias="count_web_vitals_measurements_fcp_meh",
                ),
            ],
            groupby=[
                AliasedExpression(
                    exp=Column(
                        name="tags[transaction]",
                        entity=None,
                        subscriptable="tags",
                        key="transaction",
                    ),
                    alias="transaction",
                )
            ],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 11, 11, 35, 447729, tzinfo=pytz.utc),
                ),
                Condition(
                    lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 11, 11, 35, 447729, tzinfo=pytz.utc),
                ),
                Condition(
                    lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                    op=Op.IN,
                    rhs=[11],
                ),
                Condition(
                    lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                    op=Op.EQ,
                    rhs=11,
                ),
            ],
            having=[],
            orderby=[],
            limitby=None,
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            granularity=None,
            totals=None,
        ),
        MetricsQuery(
            org_id=11,
            project_ids=[11],
            select=[
                MetricField(
                    op="count_web_vitals_measurements",
                    metric_name="d:transactions/measurements.cls@millisecond",
                    args=["good"],
                    alias="count_web_vitals_measurements_cls_good",
                ),
                MetricField(
                    op="count_web_vitals_measurements",
                    metric_name="d:transactions/measurements.fid@millisecond",
                    args=["meh"],
                    alias="count_web_vitals_measurements_fid_meh",
                ),
                MetricField(
                    op="count_web_vitals_measurements",
                    metric_name="d:transactions/measurements.fp@millisecond",
                    args=["good"],
                    alias="count_web_vitals_measurements_fp_good",
                ),
                MetricField(
                    op="count_web_vitals_measurements",
                    metric_name="d:transactions/measurements.lcp@millisecond",
                    args=["good"],
                    alias="count_web_vitals_measurements_lcp_good",
                ),
                MetricField(
                    op="count_web_vitals_measurements",
                    metric_name="d:transactions/measurements.fcp@millisecond",
                    args=["meh"],
                    alias="count_web_vitals_measurements_fcp_meh",
                ),
            ],
            start=datetime.datetime(2022, 3, 24, 11, 11, 35, 447729, tzinfo=pytz.utc),
            end=datetime.datetime(2022, 6, 22, 11, 11, 35, 447729, tzinfo=pytz.utc),
            granularity=Granularity(granularity=3600),
            where=None,
            groupby=[MetricGroupByField("transaction", alias=None)],
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            include_series=False,
        ),
        id="count_web_vitals test case",
    ),
    pytest.param(
        Query(
            match=Entity("generic_metrics_distributions"),
            select=[
                Function(
                    function="p95",
                    initializers=None,
                    parameters=[Column("d:transactions/duration@millisecond")],
                    alias="p95",
                ),
                Function(
                    function="rate",
                    initializers=None,
                    parameters=[
                        Column("d:transactions/duration@millisecond"),
                        60,
                        7776000.0,
                    ],
                    alias="epm",
                ),
                Function(
                    function="e:transaction/failure_rate@ratio",
                    initializers=None,
                    parameters=[],
                    alias="failure_rate",
                ),
            ],
            groupby=[
                AliasedExpression(
                    exp=Column("transaction.status"),
                    alias="transaction.status",
                ),
                Function(
                    function="e:transactions/team_key_transactions@none",
                    initializers=None,
                    parameters=[
                        [(13, "foo_transaction")],
                    ],
                    alias="team_key_transaction",
                ),
                AliasedExpression(exp=Column("transaction"), alias="title"),
                Column("project_id"),
            ],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 11, 11, 36, 75132, tzinfo=pytz.utc),
                ),
                Condition(
                    lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 11, 11, 36, 75132, tzinfo=pytz.utc),
                ),
                Condition(
                    lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                    op=Op.IN,
                    rhs=[13],
                ),
                Condition(
                    lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                    op=Op.EQ,
                    rhs=14,
                ),
            ],
            having=[],
            orderby=[
                OrderBy(
                    exp=Function(
                        function="p95",
                        initializers=None,
                        parameters=[Column("d:transactions/duration@millisecond")],
                        alias="p95",
                    ),
                    direction=Direction.ASC,
                )
            ],
            limitby=None,
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            granularity=None,
            totals=None,
        ),
        MetricsQuery(
            org_id=14,
            project_ids=[13],
            select=[
                MetricField(
                    op="p95",
                    metric_name="d:transactions/duration@millisecond",
                    alias="p95",
                ),
                MetricField(
                    op="rate",
                    metric_name="d:transactions/duration@millisecond",
                    args=[60, 7776000.0],
                    alias="epm",
                ),
                MetricField(
                    op=None,
                    metric_name="e:transaction/failure_rate@ratio",
                    alias="failure_rate",
                ),
                MetricField(
                    op=None,
                    metric_name="e:transactions/team_key_transactions@none",
                    args=[[(20, "foo_transaction")]],
                    alias="team_key_transaction",
                ),
            ],
            start=datetime.datetime(2022, 3, 24, 11, 11, 38, 32475, tzinfo=pytz.utc),
            end=datetime.datetime(2022, 6, 22, 11, 11, 38, 32475, tzinfo=pytz.utc),
            granularity=Granularity(granularity=3600),
            where=None,
            groupby=[
                MetricGroupByField("transaction.status"),
                MetricGroupByField(
                    MetricField(
                        op=None,
                        metric_name="e:transactions/team_key_transactions@none",
                        args=[[(20, "foo_transaction")]],
                        alias="e:transactions/team_key_transactions@none",
                    ),
                ),
                MetricGroupByField("project_id"),
                MetricGroupByField("transaction", alias="title"),
            ],
            orderby=[
                OrderBy(
                    field=MetricField(
                        op=None,
                        metric_name="e:transactions/team_key_transactions@none",
                        args=[[(20, "foo_transaction")]],
                        alias="e:transactions/team_key_transactions@none",
                    ),
                    direction=Direction.ASC,
                ),
                OrderBy(
                    field=MetricField(
                        op="p95",
                        metric_name="d:transactions/duration@millisecond",
                        alias="p95",
                    ),
                    direction=Direction.ASC,
                ),
            ],
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            include_series=False,
        ),
        id="team_key_transaction + groupby & select aliasing test case",
    ),
    pytest.param(
        Query(
            match=Entity("generic_metrics_distributions"),
            select=[
                Function(
                    function="e:transactions/apdex@ratio",
                    initializers=None,
                    parameters=[],
                    alias="apdex",
                ),
                Function(
                    function="p75",
                    initializers=None,
                    parameters=[
                        Column("d:transactions/measurements.cls@millisecond"),
                    ],
                    alias="p75_measurements_cls",
                ),
                Function(
                    function="rate",
                    initializers=None,
                    parameters=[
                        Column("d:transactions/duration@millisecond"),
                        60,
                        7776000.0,
                    ],
                    alias="tpm",
                ),
                Function(
                    function="p75",
                    initializers=None,
                    parameters=[Column("d:transactions/measurements.fid@millisecond")],
                    alias="p75_measurements_fid",
                ),
                Function(
                    function="p75",
                    initializers=None,
                    parameters=[Column("d:transactions/measurements.fcp@millisecond")],
                    alias="p75_measurements_fcp",
                ),
                Function(
                    function="p75",
                    initializers=None,
                    parameters=[Column("d:transactions/measurements.lcp@millisecond")],
                    alias="p75_measurements_lcp",
                ),
            ],
            groupby=[
                AliasedExpression(
                    exp=Column("transaction"),
                    alias="transaction",
                ),
                Column("project_id"),
            ],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 11, 11, 37, 278535, tzinfo=pytz.utc),
                ),
                Condition(
                    lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 11, 11, 37, 278535, tzinfo=pytz.utc),
                ),
                Condition(
                    lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                    op=Op.IN,
                    rhs=[18],
                ),
                Condition(
                    lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                    op=Op.EQ,
                    rhs=19,
                ),
            ],
            having=[],
            orderby=[],
            limitby=None,
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            granularity=None,
            totals=None,
        ),
        MetricsQuery(
            org_id=19,
            project_ids=[18],
            select=[
                MetricField(
                    op=None,
                    metric_name="e:transactions/apdex@ratio",
                    alias="apdex",
                ),
                MetricField(
                    op="p75",
                    metric_name="d:transactions/measurements.cls@millisecond",
                    alias="p75_measurement_cls",
                ),
                MetricField(
                    op="rate",
                    metric_name="d:transactions/duration@millisecond",
                    args=[60, 7776000.0],
                    alias="tpm",
                ),
                MetricField(
                    op="p75",
                    metric_name="d:transactions/measurements.fid@millisecond",
                    alias="p75_measurement_fid",
                ),
                MetricField(
                    op="p75",
                    metric_name="d:transactions/measurements.fcp@millisecond",
                    alias="p75_measurement_fcp",
                ),
                MetricField(
                    op="p75",
                    metric_name="d:transactions/measurements.lcp@millisecond",
                    alias="p75_measurement_lcp",
                ),
            ],
            start=datetime.datetime(2022, 3, 24, 11, 11, 37, 278535, tzinfo=pytz.utc),
            end=datetime.datetime(2022, 6, 22, 11, 11, 37, 278535, tzinfo=pytz.utc),
            granularity=Granularity(granularity=3600),
            where=None,
            groupby=[
                MetricGroupByField("project_id", alias=None),
                MetricGroupByField("transaction", alias=None),
            ],
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            include_series=False,
        ),
        id="apdex + percentiles test cases",
    ),
    pytest.param(
        Query(
            match=Entity("generic_metrics_sets"),
            select=[
                Function(
                    function="count_unique",
                    initializers=None,
                    parameters=[
                        Column("s:transactions/user@none"),
                    ],
                    alias="count_unique_user",
                ),
            ],
            groupby=[
                AliasedExpression(
                    exp=Column(
                        name="tags[transaction]",
                        entity=None,
                        subscriptable="tags",
                        key="transaction",
                    ),
                    alias="transaction",
                )
            ],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 11, 11, 33, 21219, tzinfo=pytz.utc),
                ),
                Condition(
                    lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 11, 11, 33, 21219, tzinfo=pytz.utc),
                ),
                Condition(
                    lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                    op=Op.IN,
                    rhs=[2],
                ),
                Condition(
                    lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                    op=Op.EQ,
                    rhs=2,
                ),
                Condition(
                    lhs=Function(
                        function="tuple",
                        initializers=None,
                        parameters=[
                            Column(
                                name="tags[transaction]",
                                entity=None,
                                subscriptable="tags",
                                key="transaction",
                            )
                        ],
                        alias=None,
                    ),
                    op=Op.IN,
                    rhs=Function(
                        function="tuple",
                        initializers=None,
                        parameters=[("foo_transaction",), ("bar_transaction",)],
                        alias=None,
                    ),
                ),
            ],
            having=[],
            orderby=[],
            limitby=None,
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            granularity=None,
            totals=None,
        ),
        MetricsQuery(
            org_id=2,
            project_ids=[2],
            select=[
                MetricField(
                    op="count_unique",
                    metric_name="d:transactions/duration@millisecond",
                    alias="count_unique_user",
                )
            ],
            start=datetime.datetime(2022, 3, 24, 11, 11, 33, 21219, tzinfo=pytz.utc),
            end=datetime.datetime(2022, 6, 22, 11, 11, 33, 21219, tzinfo=pytz.utc),
            granularity=Granularity(granularity=3600),
            where=[
                Condition(
                    lhs=Function(
                        function="tuple",
                        initializers=None,
                        parameters=[
                            Column(
                                name="tags[transaction]",
                                entity=None,
                                subscriptable="tags",
                                key="transaction",
                            )
                        ],
                        alias=None,
                    ),
                    op=Op.IN,
                    rhs=Function(
                        function="tuple",
                        initializers=None,
                        parameters=[("foo_transaction",), ("bar_transaction",)],
                        alias=None,
                    ),
                ),
            ],
            groupby=[
                MetricGroupByField("project_id", alias=None),
                MetricGroupByField("transaction", alias=None),
            ],
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            include_series=False,
        ),
        id="tuple condition + metrics sets test case",
    ),
    pytest.param(
        Query(
            match=Entity("generic_metrics_sets"),
            select=[
                Function(
                    function="count_unique",
                    initializers=None,
                    parameters=[
                        Column("s:transactions/user@none"),
                    ],
                    alias="count_unique_user",
                )
            ],
            groupby=[AliasedExpression(Column("bucketed_time"), "time")],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 6, 21, 10, 0, tzinfo=None),
                ),
                Condition(
                    lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 21, 12, 0, tzinfo=None),
                ),
                Condition(
                    lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                    op=Op.IN,
                    rhs=[2],
                ),
                Condition(
                    lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                    op=Op.EQ,
                    rhs=2,
                ),
            ],
            having=[],
            orderby=[],
            limitby=None,
            limit=Limit(limit=50),
            offset=None,
            granularity=Granularity(granularity=60),
            totals=None,
        ),
        MetricsQuery(
            org_id=2,
            project_ids=[2],
            select=[
                MetricField(
                    op="count_unique",
                    metric_name="s:transactions/user@none",
                    alias="count_unique_user",
                )
            ],
            start=datetime.datetime(2022, 6, 21, 10, 0, tzinfo=None),
            end=datetime.datetime(2022, 6, 21, 12, 0, tzinfo=None),
            granularity=Granularity(granularity=60),
            where=None,
            groupby=None,
            include_series=True,
            include_totals=True,
            limit=Limit(limit=50),
            offset=Offset(offset=0),
        ),
        id="series query test case",
    ),
    # Histogram Query
    pytest.param(
        Query(
            match=Entity("generic_metrics_distributions"),
            select=[
                Function(
                    function="histogram",
                    parameters=[
                        Column("d:transactions/duration@millisecond"),
                        0,  # min
                        5,  # max
                        5,  # num_buckets
                    ],
                    alias="histogram_transaction_duration",
                ),
            ],
            groupby=[],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 14, 52, 59, 179755),
                ),
                Condition(
                    lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 14, 52, 59, 179755),
                ),
                Condition(
                    lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                    op=Op.IN,
                    rhs=[3],
                ),
                Condition(
                    lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                    op=Op.EQ,
                    rhs=3,
                ),
            ],
            having=[],
            orderby=[],
            limitby=None,
            limit=Limit(limit=50),
            offset=Offset(offset=0),
            granularity=None,
            totals=None,
        ),
        MetricsQuery(
            org_id=3,
            project_ids=[3],
            select=[
                MetricField(
                    op="histogram",
                    metric_name="d:transactions/duration@millisecond",
                    args=[0, 5, 5],  # min  # max  # num_buckets
                    alias="histogram_transaction_duration",
                )
            ],
            start=datetime.datetime(2022, 3, 24, 14, 52, 59, 179755, tzinfo=pytz.utc),
            end=datetime.datetime(2022, 6, 22, 14, 52, 59, 179755, tzinfo=pytz.utc),
            granularity=None,
            where=None,
            groupby=None,
            include_series=True,
            include_totals=True,
            limit=Limit(limit=50),
            offset=Offset(offset=0),
        ),
        id="histogram query test case",
    ),
]


@pytest.mark.parametrize(
    "input, output",
    VALID_QUERIES_INTEGRATION_TEST_CASES,
)
def test_mqb_to_metrics_query_tranformer(input, output):
    assert tranform_mqb_query_to_metrics_query(input) == output
