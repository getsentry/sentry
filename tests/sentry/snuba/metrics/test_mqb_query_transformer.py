import datetime
import re

import pytest
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import BooleanCondition, BooleanOp, Condition, Op
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity, Limit, Offset
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import Query

from sentry.snuba.metrics import MetricConditionField, MetricField, MetricGroupByField, MetricsQuery
from sentry.snuba.metrics import OrderBy as MetricsOrderBy
from sentry.snuba.metrics.mqb_query_transformer import (
    MQBQueryTransformationException,
    tranform_mqb_query_to_metrics_query,
)

"""
Notes:
- Parameter argument order for non column arguments should match the order of arguments after (aggregate_filter,
org_id) or just (aggregate_filter) in the SnQL generator functions. As an example, if we define a histogram
function in SnQL as:-
Function(
    function="histogram",
    parameters=[
        Column("d:transactions/duration@millisecond"),
        0,  # histogram_from
        5,  # histogram_to
        5,  # num_buckets
    ],
    alias="histogram_transaction_duration",
)

then the order of arguments after the Column argument (i.e. numeric arguments) should be histogram_from, histogram_to,
num_buckets matching the order in the following SnQL generator function definition

def histogram_snql_factory(aggregate_filter, histogram_from, histogram_to, histogram_buckets, alias)

These SnQL function generators can be found in `sentry/src/sentry/snuba/metrics/fields/base.py`, and these are
defined for all derived operations i.e. operations not supported by clickhouse like rate, count_web_vitals,
histogram (as it requires extra logic over the clickhouse function supported by datasketch), team_key_transaction,
and count_transaction_name (for unparameterized and None)

All non clickhouse functions (derived functions) are listed here
https://github.com/getsentry/sentry/blob/0eb312411989c2dbde3cf0b5094d47829d01c854/src/sentry/snuba/metrics/fields/base.py#L1505-L1540
- Originally, it was agreed that all derived metrics such as failure_rate, user_misery and the other ones listed here
https://github.com/getsentry/sentry/blob/4d3efb171ac2fc3ac77a846ec3d96f0da829ed12/src/sentry/snuba/metrics/naming_layer/mri.py#L98-L106
would be passed as SnQL functions. However, this won't work without expanding the snuba-sdk Function regex to accept MRI
format which does not really make sense to do, and hence it is best if they are provided in Column, or AliasedExpression
as the Column regex has been expanded to accept MRI, and those derived metrics do not accept any arguments anyways.
- Granularity is not handled here yet and so defaulted to 3600 but the metrics service layer handles granularity
based on time bounds provided and if this behaviour is intended to be different, that logic will me modified within
the metrics layer. However, passing granularity is abstracted to metrics layer (There is an ongoing discussion about
specifically this)
"""

VALID_QUERIES_INTEGRATION_TEST_CASES = [
    # Totals Query
    pytest.param(
        Query(
            match=Entity("generic_metrics_distributions"),
            select=[
                Function(
                    function="count_web_vitals",
                    parameters=[Column("d:transactions/measurements.cls@millisecond"), "good"],
                    alias="count_web_vitals_measurements_cls_good",
                ),
                Function(
                    function="count_web_vitals",
                    parameters=[Column("d:transactions/measurements.fid@millisecond"), "meh"],
                    alias="count_web_vitals_measurements_fid_meh",
                ),
                Function(
                    function="count_web_vitals",
                    parameters=[Column("d:transactions/measurements.fp@millisecond"), "good"],
                    alias="count_web_vitals_measurements_fp_good",
                ),
                Function(
                    function="count_web_vitals",
                    parameters=[Column("d:transactions/measurements.lcp@millisecond"), "good"],
                    alias="count_web_vitals_measurements_lcp_good",
                ),
                Function(
                    function="count_web_vitals",
                    parameters=[Column("d:transactions/measurements.fcp@millisecond"), "meh"],
                    alias="count_web_vitals_measurements_fcp_meh",
                ),
            ],
            groupby=[
                AliasedExpression(
                    exp=Column(
                        name="tags[transaction]",
                    ),
                    alias="transaction",
                )
            ],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 11, 11, 35, 447729),
                ),
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 11, 11, 35, 447729),
                ),
                Condition(
                    lhs=Column(
                        name="project_id",
                    ),
                    op=Op.IN,
                    rhs=[11],
                ),
                Condition(
                    lhs=Column(
                        name="org_id",
                    ),
                    op=Op.EQ,
                    rhs=11,
                ),
            ],
            having=[],
            orderby=[],
            limitby=None,
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            granularity=Granularity(granularity=86400),
            totals=None,
        ),
        MetricsQuery(
            org_id=11,
            project_ids=[11],
            select=[
                MetricField(
                    op="count_web_vitals",
                    metric_mri="d:transactions/measurements.cls@millisecond",
                    params={"measurement_rating": "good"},
                    alias="count_web_vitals_measurements_cls_good",
                ),
                MetricField(
                    op="count_web_vitals",
                    metric_mri="d:transactions/measurements.fid@millisecond",
                    params={"measurement_rating": "meh"},
                    alias="count_web_vitals_measurements_fid_meh",
                ),
                MetricField(
                    op="count_web_vitals",
                    metric_mri="d:transactions/measurements.fp@millisecond",
                    params={"measurement_rating": "good"},
                    alias="count_web_vitals_measurements_fp_good",
                ),
                MetricField(
                    op="count_web_vitals",
                    metric_mri="d:transactions/measurements.lcp@millisecond",
                    params={"measurement_rating": "good"},
                    alias="count_web_vitals_measurements_lcp_good",
                ),
                MetricField(
                    op="count_web_vitals",
                    metric_mri="d:transactions/measurements.fcp@millisecond",
                    params={"measurement_rating": "meh"},
                    alias="count_web_vitals_measurements_fcp_meh",
                ),
            ],
            start=datetime.datetime(2022, 3, 24, 11, 11, 35, 447729),
            end=datetime.datetime(2022, 6, 22, 11, 11, 35, 447729),
            granularity=Granularity(granularity=86400),
            where=None,
            groupby=[MetricGroupByField("transaction")],
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
                    parameters=[Column("d:transactions/duration@millisecond")],
                    alias="p95",
                ),
                Function(
                    function="rate",
                    parameters=[
                        Column("d:transactions/duration@millisecond"),
                        7776000.0,
                        60,
                    ],
                    alias="epm",
                ),
                AliasedExpression(
                    exp=Column("e:transactions/failure_rate@ratio"),
                    alias="failure_rate",
                ),
                Function(
                    function="team_key_transaction",
                    parameters=[
                        Column("d:transactions/duration@millisecond"),
                        [(13, "foo_transaction")],
                    ],
                    alias="team_key_transaction",
                ),
            ],
            groupby=[
                AliasedExpression(
                    exp=Column("tags[transaction.status]"),
                    alias="transaction.status",
                ),
                Function(
                    function="team_key_transaction",
                    parameters=[
                        Column("d:transactions/duration@millisecond"),
                        [(13, "foo_transaction")],
                    ],
                    alias="team_key_transaction",
                ),
                AliasedExpression(exp=Column("tags[transaction]"), alias="title"),
                Column("project_id"),
            ],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 11, 11, 36, 75132),
                ),
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 11, 11, 36, 75132),
                ),
                Condition(
                    lhs=Column(
                        name="project_id",
                    ),
                    op=Op.IN,
                    rhs=[13],
                ),
                Condition(
                    lhs=Column(
                        name="org_id",
                    ),
                    op=Op.EQ,
                    rhs=14,
                ),
                Condition(
                    lhs=Function(
                        function="team_key_transaction",
                        parameters=[
                            Column("d:transactions/duration@millisecond"),
                            [(13, "foo_transaction")],
                        ],
                        alias="team_key_transaction",
                    ),
                    op=Op.EQ,
                    rhs=1,
                ),
            ],
            having=[],
            orderby=[
                OrderBy(
                    exp=Function(
                        function="p95",
                        parameters=[Column("d:transactions/duration@millisecond")],
                        alias="p95",
                    ),
                    direction=Direction.ASC,
                ),
                OrderBy(
                    exp=Function(
                        function="team_key_transaction",
                        parameters=[
                            Column("d:transactions/duration@millisecond"),
                            [(13, "foo_transaction")],
                        ],
                        alias="team_key_transaction",
                    ),
                    direction=Direction.ASC,
                ),
            ],
            limitby=None,
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            granularity=Granularity(granularity=86400),
            totals=None,
        ),
        MetricsQuery(
            org_id=14,
            project_ids=[13],
            select=[
                MetricField(
                    op="p95",
                    metric_mri="d:transactions/duration@millisecond",
                    alias="p95",
                ),
                MetricField(
                    op="rate",
                    metric_mri="d:transactions/duration@millisecond",
                    params={"denominator": 60, "numerator": 7776000.0},
                    alias="epm",
                ),
                MetricField(
                    op=None,
                    metric_mri="e:transactions/failure_rate@ratio",
                    alias="failure_rate",
                ),
                MetricField(
                    op="team_key_transaction",
                    metric_mri="d:transactions/duration@millisecond",
                    params={"team_key_condition_rhs": [(13, "foo_transaction")]},
                    alias="team_key_transaction",
                ),
            ],
            start=datetime.datetime(2022, 3, 24, 11, 11, 36, 75132),
            end=datetime.datetime(2022, 6, 22, 11, 11, 36, 75132),
            granularity=Granularity(granularity=86400),
            where=[
                MetricConditionField(
                    lhs=MetricField(
                        op="team_key_transaction",
                        metric_mri="d:transactions/duration@millisecond",
                        params={"team_key_condition_rhs": [(13, "foo_transaction")]},
                        alias="team_key_transaction",
                    ),
                    op=Op.EQ,
                    rhs=1,
                )
            ],
            groupby=[
                MetricGroupByField("transaction.status"),
                MetricGroupByField(
                    MetricField(
                        op="team_key_transaction",
                        metric_mri="d:transactions/duration@millisecond",
                        params={"team_key_condition_rhs": [(13, "foo_transaction")]},
                        alias="team_key_transaction",
                    ),
                ),
                MetricGroupByField("transaction", alias="title"),
                MetricGroupByField("project_id"),
            ],
            orderby=[
                MetricsOrderBy(
                    field=MetricField(
                        op="p95",
                        metric_mri="d:transactions/duration@millisecond",
                        alias="p95",
                    ),
                    direction=Direction.ASC,
                ),
                MetricsOrderBy(
                    field=MetricField(
                        op="team_key_transaction",
                        metric_mri="d:transactions/duration@millisecond",
                        params={"team_key_condition_rhs": [(13, "foo_transaction")]},
                        alias="team_key_transaction",
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
                AliasedExpression(
                    exp=Column("e:transactions/apdex@ratio"),
                    alias="apdex",
                ),
                Function(
                    function="p75",
                    parameters=[
                        Column("d:transactions/measurements.cls@millisecond"),
                    ],
                    alias="p75_measurements_cls",
                ),
                Function(
                    function="rate",
                    parameters=[
                        Column("d:transactions/duration@millisecond"),
                        7776000.0,
                        60,
                    ],
                    alias="tpm",
                ),
                Function(
                    function="p75",
                    parameters=[Column("d:transactions/measurements.fid@millisecond")],
                    alias="p75_measurements_fid",
                ),
                Function(
                    function="p75",
                    parameters=[Column("d:transactions/measurements.fcp@millisecond")],
                    alias="p75_measurements_fcp",
                ),
                Function(
                    function="p75",
                    parameters=[Column("d:transactions/measurements.lcp@millisecond")],
                    alias="p75_measurements_lcp",
                ),
            ],
            groupby=[
                AliasedExpression(
                    exp=Column("tags[transaction]"),
                    alias="transaction",
                ),
                Column("project_id"),
            ],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 11, 11, 37, 278535),
                ),
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 11, 11, 37, 278535),
                ),
                Condition(
                    lhs=Column(
                        name="project_id",
                    ),
                    op=Op.IN,
                    rhs=[18],
                ),
                Condition(
                    lhs=Column(
                        name="org_id",
                    ),
                    op=Op.EQ,
                    rhs=19,
                ),
            ],
            having=[],
            orderby=[],
            limitby=None,
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            granularity=Granularity(granularity=86400),
            totals=None,
        ),
        MetricsQuery(
            org_id=19,
            project_ids=[18],
            select=[
                MetricField(
                    op=None,
                    metric_mri="e:transactions/apdex@ratio",
                    alias="apdex",
                ),
                MetricField(
                    op="p75",
                    metric_mri="d:transactions/measurements.cls@millisecond",
                    alias="p75_measurements_cls",
                ),
                MetricField(
                    op="rate",
                    metric_mri="d:transactions/duration@millisecond",
                    params={"numerator": 7776000.0, "denominator": 60},
                    alias="tpm",
                ),
                MetricField(
                    op="p75",
                    metric_mri="d:transactions/measurements.fid@millisecond",
                    alias="p75_measurements_fid",
                ),
                MetricField(
                    op="p75",
                    metric_mri="d:transactions/measurements.fcp@millisecond",
                    alias="p75_measurements_fcp",
                ),
                MetricField(
                    op="p75",
                    metric_mri="d:transactions/measurements.lcp@millisecond",
                    alias="p75_measurements_lcp",
                ),
            ],
            start=datetime.datetime(2022, 3, 24, 11, 11, 37, 278535),
            end=datetime.datetime(2022, 6, 22, 11, 11, 37, 278535),
            granularity=Granularity(granularity=86400),
            where=None,
            groupby=[
                MetricGroupByField("transaction", alias=None),
                MetricGroupByField("project_id", alias=None),
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
                    parameters=[
                        Column("s:transactions/user@none"),
                    ],
                    alias="count_unique_user",
                ),
            ],
            groupby=[
                Column("project_id"),
                AliasedExpression(
                    exp=Column(
                        name="tags[transaction]",
                    ),
                    alias="transaction",
                ),
            ],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 11, 11, 33, 21219),
                ),
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 11, 11, 33, 21219),
                ),
                Condition(
                    lhs=Column(
                        name="project_id",
                    ),
                    op=Op.IN,
                    rhs=[2],
                ),
                Condition(
                    lhs=Column(name="org_id"),
                    op=Op.EQ,
                    rhs=2,
                ),
                Condition(
                    lhs=Function(
                        function="tuple",
                        parameters=[
                            Column(
                                name="tags[transaction]",
                            )
                        ],
                        alias=None,
                    ),
                    op=Op.IN,
                    rhs=Function(
                        function="tuple",
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
            granularity=Granularity(granularity=3600),
            totals=None,
        ),
        MetricsQuery(
            org_id=2,
            project_ids=[2],
            select=[
                MetricField(
                    op="count_unique",
                    metric_mri="s:transactions/user@none",
                    alias="count_unique_user",
                )
            ],
            start=datetime.datetime(2022, 3, 24, 11, 11, 33, 21219),
            end=datetime.datetime(2022, 6, 22, 11, 11, 33, 21219),
            granularity=Granularity(granularity=3600),
            where=[
                Condition(
                    lhs=Function(
                        function="tuple",
                        parameters=[
                            Column(
                                name="tags[transaction]",
                            )
                        ],
                        alias=None,
                    ),
                    op=Op.IN,
                    rhs=Function(
                        function="tuple",
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
                    parameters=[
                        Column("s:transactions/user@none"),
                    ],
                    alias="count_unique_user",
                )
            ],
            groupby=[
                Function(
                    function="toStartOfInterval",
                    parameters=[
                        Column(name="timestamp"),
                        Function(
                            function="toIntervalSecond",
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                )
            ],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 6, 21, 10, 0, tzinfo=None),
                ),
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 21, 12, 0, tzinfo=None),
                ),
                Condition(
                    lhs=Column(
                        name="project_id",
                    ),
                    op=Op.IN,
                    rhs=[2],
                ),
                Condition(
                    lhs=Column(
                        name="org_id",
                    ),
                    op=Op.EQ,
                    rhs=2,
                ),
            ],
            having=[],
            orderby=[],
            limitby=None,
            limit=Limit(limit=50),
            offset=Offset(offset=0),
            granularity=Granularity(granularity=60),
            totals=None,
        ),
        MetricsQuery(
            org_id=2,
            project_ids=[2],
            select=[
                MetricField(
                    op="count_unique",
                    metric_mri="s:transactions/user@none",
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
            interval=3600,
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
                        0,  # histogram_from
                        5,  # histogram_to
                        5,  # num_buckets
                    ],
                    alias="histogram_transaction_duration",
                ),
            ],
            groupby=[],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 14, 52, 59, 179755),
                ),
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 14, 52, 59, 179755),
                ),
                Condition(
                    lhs=Column(
                        name="project_id",
                    ),
                    op=Op.IN,
                    rhs=[3],
                ),
                Condition(
                    lhs=Column(
                        name="org_id",
                    ),
                    op=Op.EQ,
                    rhs=3,
                ),
            ],
            having=[],
            orderby=[],
            limitby=None,
            limit=Limit(limit=50),
            offset=Offset(offset=0),
            granularity=Granularity(granularity=3600),
            totals=None,
        ),
        MetricsQuery(
            org_id=3,
            project_ids=[3],
            select=[
                MetricField(
                    op="histogram",
                    metric_mri="d:transactions/duration@millisecond",
                    params={"histogram_from": 0, "histogram_to": 5, "histogram_buckets": 5},
                    alias="histogram_transaction_duration",
                )
            ],
            start=datetime.datetime(2022, 3, 24, 14, 52, 59, 179755),
            end=datetime.datetime(2022, 6, 22, 14, 52, 59, 179755),
            granularity=Granularity(3600),
            where=None,
            groupby=None,
            include_series=False,
            include_totals=True,
            limit=Limit(limit=50),
            offset=Offset(offset=0),
        ),
        id="histogram query test case",
    ),
    # Count transaction name
    pytest.param(
        Query(
            match=Entity("generic_metrics_distributions"),
            select=[
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions/duration@millisecond"), "is_null"],
                    alias="null_transaction_count",
                ),
                Function(
                    function="count_transaction_name",
                    parameters=[
                        Column("d:transactions/duration@millisecond"),
                        "is_unparameterized",
                    ],
                    alias="unparameterized_transaction_count",
                ),
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                    alias="has_value_transaction_count",
                ),
            ],
            groupby=[],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 14, 52, 59, 179755),
                ),
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 14, 52, 59, 179755),
                ),
                Condition(
                    lhs=Column(
                        name="project_id",
                    ),
                    op=Op.IN,
                    rhs=[3],
                ),
                Condition(
                    lhs=Column(
                        name="org_id",
                    ),
                    op=Op.EQ,
                    rhs=3,
                ),
            ],
            having=[],
            orderby=[],
            limitby=None,
            limit=Limit(limit=50),
            offset=Offset(offset=0),
            granularity=Granularity(granularity=3600),
            totals=None,
        ),
        MetricsQuery(
            org_id=3,
            project_ids=[3],
            select=[
                MetricField(
                    op="count_transaction_name",
                    metric_mri="d:transactions/duration@millisecond",
                    params={"transaction_name": "is_null"},
                    alias="null_transaction_count",
                ),
                MetricField(
                    op="count_transaction_name",
                    metric_mri="d:transactions/duration@millisecond",
                    params={"transaction_name": "is_unparameterized"},
                    alias="unparameterized_transaction_count",
                ),
                MetricField(
                    op="count_transaction_name",
                    metric_mri="d:transactions/duration@millisecond",
                    params={"transaction_name": "has_value"},
                    alias="has_value_transaction_count",
                ),
            ],
            start=datetime.datetime(2022, 3, 24, 14, 52, 59, 179755),
            end=datetime.datetime(2022, 6, 22, 14, 52, 59, 179755),
            granularity=Granularity(3600),
            where=None,
            groupby=None,
            include_series=False,
            include_totals=True,
            limit=Limit(limit=50),
            offset=Offset(offset=0),
        ),
        id="count_transaction_name query test case",
    ),
    # Transform null to unparameterized
    pytest.param(
        Query(
            match=Entity("generic_metrics_distributions"),
            select=[
                Function(
                    function="count",
                    parameters=[
                        Column("d:transactions/duration@millisecond"),
                    ],
                    alias="duration_count",
                ),
            ],
            groupby=[
                Function(
                    function="transform_null_to_unparameterized",
                    parameters=[Column("d:transactions/duration@millisecond"), "transaction"],
                    alias="transformed_transaction",
                )
            ],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 14, 52, 59, 179755),
                ),
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 14, 52, 59, 179755),
                ),
                Condition(
                    lhs=Column(
                        name="project_id",
                    ),
                    op=Op.IN,
                    rhs=[3],
                ),
                Condition(
                    lhs=Column(
                        name="org_id",
                    ),
                    op=Op.EQ,
                    rhs=3,
                ),
            ],
            having=[],
            orderby=[],
            limitby=None,
            limit=Limit(limit=50),
            offset=Offset(offset=0),
            granularity=Granularity(granularity=3600),
            totals=None,
        ),
        MetricsQuery(
            org_id=3,
            project_ids=[3],
            select=[
                MetricField(
                    op="count",
                    metric_mri="d:transactions/duration@millisecond",
                    alias="duration_count",
                ),
            ],
            start=datetime.datetime(2022, 3, 24, 14, 52, 59, 179755),
            end=datetime.datetime(2022, 6, 22, 14, 52, 59, 179755),
            granularity=Granularity(3600),
            where=None,
            groupby=[
                MetricGroupByField(
                    field=MetricField(
                        op="transform_null_to_unparameterized",
                        metric_mri="d:transactions/duration@millisecond",
                        params={"tag_key": "transaction"},
                        alias="transformed_transaction",
                    ),
                    alias="transformed_transaction",
                )
            ],
            include_series=False,
            include_totals=True,
            limit=Limit(limit=50),
            offset=Offset(offset=0),
        ),
        id="transform_null_to_unparameterized query test case",
    ),
    # "has" condition in where
    pytest.param(
        Query(
            match=Entity("generic_metrics_distributions"),
            select=[
                Function(
                    function="count",
                    parameters=[
                        Column("d:transactions/duration@millisecond"),
                    ],
                    alias="duration_count",
                ),
            ],
            groupby=[],
            array_join=None,
            where=[
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.GTE,
                    rhs=datetime.datetime(2022, 3, 24, 14, 52, 59, 179755),
                ),
                Condition(
                    lhs=Column(
                        name="timestamp",
                    ),
                    op=Op.LT,
                    rhs=datetime.datetime(2022, 6, 22, 14, 52, 59, 179755),
                ),
                Condition(
                    lhs=Column(
                        name="project_id",
                    ),
                    op=Op.IN,
                    rhs=[3],
                ),
                Condition(
                    lhs=Column(
                        name="org_id",
                    ),
                    op=Op.EQ,
                    rhs=3,
                ),
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
            ],
            having=[],
            orderby=[],
            limitby=None,
            limit=Limit(limit=50),
            offset=Offset(offset=0),
            granularity=Granularity(granularity=3600),
            totals=None,
        ),
        MetricsQuery(
            org_id=3,
            project_ids=[3],
            select=[
                MetricField(
                    op="count",
                    metric_mri="d:transactions/duration@millisecond",
                    alias="duration_count",
                ),
            ],
            start=datetime.datetime(2022, 3, 24, 14, 52, 59, 179755),
            end=datetime.datetime(2022, 6, 22, 14, 52, 59, 179755),
            granularity=Granularity(3600),
            where=[
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
                )
            ],
            groupby=None,
            include_series=False,
            include_totals=True,
            limit=Limit(limit=50),
            offset=Offset(offset=0),
        ),
        id="has operator query test case",
    ),
]


@pytest.mark.parametrize(
    "input, output",
    VALID_QUERIES_INTEGRATION_TEST_CASES,
)
def test_mqb_to_metrics_query_tranformer(input, output):
    assert tranform_mqb_query_to_metrics_query(input) == output


def _construct_snuba_sdk_query(
    select,
    groupby=None,
    orderby=None,
    where=None,
    having=None,
    entity="generic_metrics_distributions",
):
    if groupby is None:
        groupby = []
    if orderby is None:
        orderby = []
    if where is None:
        where = []

    return Query(
        match=Entity(entity),
        select=select,
        groupby=groupby,
        array_join=None,
        where=[
            Condition(
                lhs=Column(
                    name="timestamp",
                ),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 14, 52, 59, 179755),
            ),
            Condition(
                lhs=Column(
                    name="timestamp",
                ),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 14, 52, 59, 179755),
            ),
            Condition(
                lhs=Column(
                    name="project_id",
                ),
                op=Op.IN,
                rhs=[3],
            ),
            Condition(
                lhs=Column(
                    name="org_id",
                ),
                op=Op.EQ,
                rhs=3,
            ),
            *where,
        ],
        having=having,
        orderby=orderby,
        limitby=None,
        limit=Limit(limit=50),
        offset=Offset(offset=0),
        granularity=Granularity(granularity=3600),
        totals=None,
    )


INVALID_QUERIES_INTEGRATION_TEST_CASES = [
    # invalid orderby metrics expression with histogram
    # invalid orderby derived metric ?
    # invalid condition by adding metric field in the condition that does not support it
    # Select Statement validation
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                AliasedExpression(
                    exp=Column(name="tags[transaction]"),
                    alias="transaction",
                ),
            ],
        ),
        "Invalid Metric MRI: tags[transaction]",
        id="invalid select by requesting a tag in a Column",
    ),
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Column(name="tags[transaction]"),
            ],
        ),
        "Invalid Metric MRI: tags[transaction]",
        id="invalid select by requesting a tag in an aliased expression",
    ),
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="count_transaction_name",
                    parameters=["has_value"],
                    alias="has_value_transaction_count",
                ),
            ],
        ),
        "The first parameter of a function should be a column of the metric MRI",
        id="invalid select function since column is not provided in the first position of parameters",
    ),
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions.duration@millisecond")],
                    alias="has_value_transaction_count",
                ),
            ],
        ),
        "Too few function parameters are provided. The arguments required for function count_transaction_name are ["
        "'transaction_name']",
        id="invalid select function since not all required arguments are provided",
    ),
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="p95",
                    parameters=[],
                    alias="has_value_transaction_count",
                ),
            ],
        ),
        "The first parameter of a function should be a column of the metric MRI",
        id="invalid select function since first parameter is not an instance of Column with MRI",
    ),
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Condition(
                    lhs=Column("tag[transaction]"),
                    op=Op.EQ,
                    rhs="bar",
                ),
            ],
        ),
        "Unsupported select field "
        "Condition(lhs=Column(name='tag[transaction]', entity=None, subscriptable='tag', key='transaction'), "
        "op=<Op.EQ: '='>, rhs='bar')",
        id="Condition is not a valid select statement",
    ),
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="transform",
                    parameters=[
                        Column(name="project_id"),
                        [6],
                        ["bar"],
                        "",
                    ],
                    alias="project",
                ),
            ],
        ),
        "Function 'transform' is not supported",
        id="Unsupported function in select statement",
    ),
    # Groupby validation
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                    alias="has_value_transaction_count",
                ),
            ],
            groupby=[Column("transaction")],
        ),
        "Unsupported groupby field 'transaction'",
        id="invalid groupby string not starting with tags",
    ),
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                    alias="has_value_transaction_count",
                ),
            ],
            groupby=[AliasedExpression(exp=Column("transaction"), alias="transaction")],
        ),
        "Unsupported groupby field 'transaction'",
        id="invalid groupby string not starting with tags",
    ),
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                    alias="has_value_transaction_count",
                ),
            ],
            groupby=[
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                    alias="has_value_transaction_count",
                ),
            ],
        ),
        "Cannot group by function count_transaction_name",
        id="invalid groupby metric field",
    ),
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                    alias="has_value_transaction_count",
                ),
            ],
            groupby=[
                Function(
                    function="transform",
                    parameters=[
                        Column(name="project_id"),
                        [6],
                        ["bar"],
                        "",
                    ],
                    alias="project",
                ),
            ],
        ),
        "Cannot group by function transform",
        id="Unsupported function in groupby statement",
    ),
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                    alias="has_value_transaction_count",
                ),
            ],
            groupby=[
                Condition(
                    lhs=Column("tag[transaction]"),
                    op=Op.EQ,
                    rhs="bar",
                ),
            ],
        ),
        "Unsupported groupby field Condition(lhs=Column(name='tag[transaction]', entity=None, subscriptable='tag', key='transaction'), op=<Op.EQ: '='>, rhs='bar')",
        id="Unsupported Condition in groupby statement",
    ),
    # Where Clause Validation
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                    alias="has_value_transaction_count",
                ),
            ],
            where=[
                BooleanCondition(
                    op=BooleanOp.AND,
                    conditions=[
                        Condition(
                            lhs=Column("tag[transaction]"),
                            op=Op.EQ,
                            rhs="bar",
                        ),
                        Condition(
                            lhs=Column("tag[transaction]"),
                            op=Op.EQ,
                            rhs="foo",
                        ),
                    ],
                ),
            ],
        ),
        "Unsupported condition type in where clause",
        id="Unsupported BooleanCondition in where clause",
    ),
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                    alias="has_value_transaction_count",
                ),
            ],
            where=[
                Condition(
                    lhs=Function(
                        function="count_transaction_name",
                        parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                        alias="has_value_transaction_count",
                    ),
                    op=Op.EQ,
                    rhs=1,
                )
            ],
        ),
        "Cannot filter by function count_transaction_name",
        id="Unsupported derived op in where clause",
    ),
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                    alias="has_value_transaction_count",
                ),
            ],
            where=[
                Condition(
                    lhs=Function(
                        function="p95",
                        parameters=[Column("d:transactions/duration@millisecond")],
                        alias="p95",
                    ),
                    op=Op.EQ,
                    rhs=1,
                )
            ],
        ),
        "Unsupported function 'p95' in where",
        id="Unsupported function/operation in where clause",
    ),
    # Validate having clause
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="count_transaction_name",
                    parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                    alias="has_value_transaction_count",
                ),
            ],
            having=[
                Condition(
                    lhs=Function(
                        function="count_transaction_name",
                        parameters=[Column("d:transactions/duration@millisecond"), "has_value"],
                        alias="has_value_transaction_count",
                    ),
                    op=Op.EQ,
                    rhs=1,
                )
            ],
        ),
        "Having clauses are not supported by the metrics layer",
        id="Unsupported having clause",
    ),
    # Validate OrderBy statements
    pytest.param(
        _construct_snuba_sdk_query(
            select=[
                Function(
                    function="histogram",
                    parameters=[
                        Column("d:transactions/duration@millisecond"),
                        0,  # histogram_from
                        5,  # histogram_to
                        5,  # num_buckets
                    ],
                    alias="histogram_transaction_duration",
                ),
            ],
            orderby=[
                OrderBy(
                    Function(
                        function="histogram",
                        parameters=[
                            Column("d:transactions/duration@millisecond"),
                            0,  # histogram_from
                            5,  # histogram_to
                            5,  # num_buckets
                        ],
                        alias="histogram_transaction_duration",
                    ),
                    Direction.ASC,
                )
            ],
        ),
        "Operation histogram cannot be used to order a query",
        id="histogram is not supported in orderby",
    ),
    # Validate this transformation is only for performance metrics
    pytest.param(
        _construct_snuba_sdk_query(
            entity="metrics_sets",
            select=[
                Function(
                    function="histogram",
                    parameters=[
                        Column("d:transactions/duration@millisecond"),
                        0,  # histogram_from
                        5,  # histogram_to
                        5,  # num_buckets
                    ],
                    alias="histogram_transaction_duration",
                ),
            ],
        ),
        "Unsupported entity name for metrics_sets MQB to MetricsQuery Transformation",
        id="Transformation only supports performance metrics",
    ),
]


@pytest.mark.parametrize(
    "input, error_message",
    INVALID_QUERIES_INTEGRATION_TEST_CASES,
)
def test_invalid_mqb_queries(input, error_message):
    with pytest.raises(MQBQueryTransformationException, match=re.escape(error_message)):
        tranform_mqb_query_to_metrics_query(input)
