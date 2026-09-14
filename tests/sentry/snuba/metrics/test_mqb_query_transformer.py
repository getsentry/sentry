import datetime
import re

import pytest
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity, Limit, Offset
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import Query

from sentry.snuba.metrics.mqb_query_transformer import (
    MQBQueryTransformationException,
    _derive_mri_to_apply,
    transform_mqb_query_to_metrics_query,
)
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI

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


def _construct_snuba_sdk_query(
    select,
    groupby=None,
    orderby=None,
    where=None,
    having=None,
    entity="generic_metrics_counters",
):
    if groupby is None:
        groupby = []
    if orderby is None:
        orderby = []
    if where is None:
        where = []
    if having is None:
        having = []

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
]


@pytest.mark.parametrize(
    "input, error_message",
    INVALID_QUERIES_INTEGRATION_TEST_CASES,
)
def test_invalid_mqb_queries(input, error_message) -> None:
    with pytest.raises(MQBQueryTransformationException, match=re.escape(error_message)):
        transform_mqb_query_to_metrics_query(input)


def test_team_key_transaction_defaults_to_counter_mri() -> None:
    assert (
        _derive_mri_to_apply([1], select=[], orderby=None)
        == TransactionMRI.COUNT_PER_ROOT_PROJECT.value
    )
