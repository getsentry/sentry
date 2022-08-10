import datetime

import pytz
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import And, BooleanCondition, Condition, Op, Or
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity, Limit, Offset
from snuba_sdk.function import CurriedFunction, Function
from snuba_sdk.orderby import Direction, LimitBy, OrderBy
from snuba_sdk.query import Query

table_queries = [
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.5)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p50",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            )
        ],
        "array_join": None,
        "where": [
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
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775908, 9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [
            OrderBy(
                exp=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.5)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p50",
                ),
                direction=Direction.ASC,
            )
        ],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked + added
    {
        "match": Entity("metrics_sets"),
        "select": [
            Function(
                function="uniqIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775908,
                        ],
                        alias=None,
                    ),
                ],
                alias="count_unique_user",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            )
        ],
        "array_join": None,
        "where": [
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
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775908, 9223372036854775909],
            ),
            Condition(
                lhs=Function(
                    function="tuple",
                    initializers=None,
                    parameters=[
                        Column(
                            name="tags[9223372036854776020]",
                            entity=None,
                            subscriptable="tags",
                            key="9223372036854776020",
                        )
                    ],
                    alias=None,
                ),
                op=Op.IN,
                rhs=Function(
                    function="tuple", initializers=None, parameters=[(12,), (17,)], alias=None
                ),
            ),  # transaction IN [...]
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked + added
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.5)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p50_transaction_duration",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
        ],
        "groupby": [
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [5],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 34, 26663, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 34, 26663, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[5],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=5,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [
            Condition(
                lhs=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.5)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p50_transaction_duration",
                ),
                op=Op.LT,
                rhs=50.0,
            )
        ],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked + discarded
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.5)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p50_transaction_duration",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
        ],
        "groupby": [
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [6],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 34, 303387, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 34, 303387, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[6],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=6,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [
            Condition(
                lhs=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.75)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p75_transaction_duration",
                ),
                op=Op.LT,
                rhs=50.0,
            )
        ],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked + discarded
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="countIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="and",
                        initializers=None,
                        parameters=[
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="tags[226]",
                                        entity=None,
                                        subscriptable="tags",
                                        key="226",
                                    ),
                                    250,
                                ],
                                alias=None,
                            ),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775914,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="count_web_vitals_measurements_cls_good",
            ),
            Function(
                function="countIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="and",
                        initializers=None,
                        parameters=[
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="tags[226]",
                                        entity=None,
                                        subscriptable="tags",
                                        key="226",
                                    ),
                                    236,
                                ],
                                alias=None,
                            ),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775915,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="count_web_vitals_measurements_fid_meh",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="countIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="and",
                        initializers=None,
                        parameters=[
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="tags[226]",
                                        entity=None,
                                        subscriptable="tags",
                                        key="226",
                                    ),
                                    250,
                                ],
                                alias=None,
                            ),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775916,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="count_web_vitals_measurements_fp_good",
            ),
            Function(
                function="countIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="and",
                        initializers=None,
                        parameters=[
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="tags[226]",
                                        entity=None,
                                        subscriptable="tags",
                                        key="226",
                                    ),
                                    250,
                                ],
                                alias=None,
                            ),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775911,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="count_web_vitals_measurements_lcp_good",
            ),
            Function(
                function="countIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="and",
                        initializers=None,
                        parameters=[
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="tags[226]",
                                        entity=None,
                                        subscriptable="tags",
                                        key="226",
                                    ),
                                    236,
                                ],
                                alias=None,
                            ),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775910,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="count_web_vitals_measurements_fcp_meh",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            )
        ],
        "array_join": None,
        "where": [
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
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[
                    9223372036854775910,
                    9223372036854775911,
                    9223372036854775914,
                    9223372036854775915,
                    9223372036854775916,
                ],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked + added
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="toUInt64",
                initializers=None,
                parameters=[0],
                alias="count_web_vitals_measurements_lcp_poor",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            )
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 35, 707018, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 35, 707018, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[12],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=12,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775911],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked + discarded
    {
        "match": Entity("metrics_distributions"),
        "select": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.95)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p95",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="epm",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="equals",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="metric_id",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            9223372036854775909,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="notIn",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="tags[9223372036854776021]",
                                                entity=None,
                                                subscriptable="tags",
                                                key="9223372036854776021",
                                            ),
                                            [
                                                9223372036854776028,
                                                9223372036854776027,
                                                9223372036854776029,
                                            ],
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="failure_rate",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            Function(
                function="toInt8", initializers=None, parameters=[0], alias="team_key_transaction"
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [13],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
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
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [
            OrderBy(
                exp=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.95)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p95",
                ),
                direction=Direction.ASC,
            )
        ],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.5)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p50",
            )
        ],
        "groupby": [],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 36, 936975, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 36, 936975, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[17],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=18,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=101),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="plus",
                        initializers=None,
                        parameters=[
                            Function(
                                function="countIf",
                                initializers=None,
                                parameters=[
                                    Column(name="value", entity=None, subscriptable=None, key=None),
                                    Function(
                                        function="and",
                                        initializers=None,
                                        parameters=[
                                            Function(
                                                function="equals",
                                                initializers=None,
                                                parameters=[
                                                    Column(
                                                        name="metric_id",
                                                        entity=None,
                                                        subscriptable=None,
                                                        key=None,
                                                    ),
                                                    9223372036854775909,
                                                ],
                                                alias=None,
                                            ),
                                            Function(
                                                function="equals",
                                                initializers=None,
                                                parameters=[
                                                    Column(
                                                        name="tags[446]",
                                                        entity=None,
                                                        subscriptable="tags",
                                                        key="446",
                                                    ),
                                                    429,
                                                ],
                                                alias=None,
                                            ),
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                            Function(
                                function="divide",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="countIf",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="value",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            Function(
                                                function="and",
                                                initializers=None,
                                                parameters=[
                                                    Function(
                                                        function="equals",
                                                        initializers=None,
                                                        parameters=[
                                                            Column(
                                                                name="metric_id",
                                                                entity=None,
                                                                subscriptable=None,
                                                                key=None,
                                                            ),
                                                            9223372036854775909,
                                                        ],
                                                        alias=None,
                                                    ),
                                                    Function(
                                                        function="equals",
                                                        initializers=None,
                                                        parameters=[
                                                            Column(
                                                                name="tags[427]",
                                                                entity=None,
                                                                subscriptable="tags",
                                                                key="427",
                                                            ),
                                                            429,
                                                        ],
                                                        alias=None,
                                                    ),
                                                ],
                                                alias=None,
                                            ),
                                        ],
                                        alias=None,
                                    ),
                                    2,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            )
                        ],
                        alias=None,
                    ),
                ],
                alias="apdex",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.75)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775914,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p75_measurements_cls",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="tpm",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.75)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775915,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p75_measurements_fid",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.75)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775910,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p75_measurements_fcp",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.75)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775911,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p75_measurements_lcp",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [18],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
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
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[
                    9223372036854775908,
                    9223372036854775909,
                    9223372036854775910,
                    9223372036854775911,
                    9223372036854775914,
                    9223372036854775915,
                ],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_sets"),
        "select": [
            Function(
                function="uniqIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775908,
                        ],
                        alias=None,
                    ),
                ],
                alias="count_unique_user",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="uniqIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="and",
                        initializers=None,
                        parameters=[
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775908,
                                ],
                                alias=None,
                            ),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="tags[440]",
                                        entity=None,
                                        subscriptable="tags",
                                        key="440",
                                    ),
                                    429,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="count_miserable_user",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="plus",
                        initializers=None,
                        parameters=[
                            Function(
                                function="uniqIf",
                                initializers=None,
                                parameters=[
                                    Column(name="value", entity=None, subscriptable=None, key=None),
                                    Function(
                                        function="and",
                                        initializers=None,
                                        parameters=[
                                            Function(
                                                function="equals",
                                                initializers=None,
                                                parameters=[
                                                    Column(
                                                        name="metric_id",
                                                        entity=None,
                                                        subscriptable=None,
                                                        key=None,
                                                    ),
                                                    9223372036854775908,
                                                ],
                                                alias=None,
                                            ),
                                            Function(
                                                function="equals",
                                                initializers=None,
                                                parameters=[
                                                    Column(
                                                        name="tags[440]",
                                                        entity=None,
                                                        subscriptable="tags",
                                                        key="440",
                                                    ),
                                                    429,
                                                ],
                                                alias=None,
                                            ),
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias="count_miserable_user",
                            ),
                            5.8875,
                        ],
                        alias=None,
                    ),
                    Function(
                        function="plus",
                        initializers=None,
                        parameters=[
                            Function(
                                function="nullIf",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="uniqIf",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="value",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            Function(
                                                function="equals",
                                                initializers=None,
                                                parameters=[
                                                    Column(
                                                        name="metric_id",
                                                        entity=None,
                                                        subscriptable=None,
                                                        key=None,
                                                    ),
                                                    9223372036854775908,
                                                ],
                                                alias=None,
                                            ),
                                        ],
                                        alias="count_unique_user",
                                    ),
                                    0,
                                ],
                                alias=None,
                            ),
                            117.75,
                        ],
                        alias=None,
                    ),
                ],
                alias="user_misery",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [18],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
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
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[
                    9223372036854775908,
                    9223372036854775909,
                    9223372036854775910,
                    9223372036854775911,
                    9223372036854775914,
                    9223372036854775915,
                ],
            ),
            Condition(
                lhs=Function(
                    function="tuple",
                    initializers=None,
                    parameters=[
                        Column(
                            name="tags[9223372036854776020]",
                            entity=None,
                            subscriptable="tags",
                            key="9223372036854776020",
                        ),
                        Function(
                            function="transform",
                            initializers=None,
                            parameters=[
                                Column(
                                    name="project_id", entity=None, subscriptable=None, key=None
                                ),
                                [18],
                                ["bar"],
                                "",
                            ],
                            alias="project",
                        ),
                    ],
                    alias=None,
                ),
                op=Op.IN,
                rhs=Function(
                    function="tuple", initializers=None, parameters=[(437, "bar")], alias=None
                ),
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="plus",
                        initializers=None,
                        parameters=[
                            Function(
                                function="countIf",
                                initializers=None,
                                parameters=[
                                    Column(name="value", entity=None, subscriptable=None, key=None),
                                    Function(
                                        function="and",
                                        initializers=None,
                                        parameters=[
                                            Function(
                                                function="equals",
                                                initializers=None,
                                                parameters=[
                                                    Column(
                                                        name="metric_id",
                                                        entity=None,
                                                        subscriptable=None,
                                                        key=None,
                                                    ),
                                                    9223372036854775909,
                                                ],
                                                alias=None,
                                            ),
                                            Function(
                                                function="equals",
                                                initializers=None,
                                                parameters=[
                                                    Column(
                                                        name="tags[446]",
                                                        entity=None,
                                                        subscriptable="tags",
                                                        key="446",
                                                    ),
                                                    429,
                                                ],
                                                alias=None,
                                            ),
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                            Function(
                                function="divide",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="countIf",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="value",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            Function(
                                                function="and",
                                                initializers=None,
                                                parameters=[
                                                    Function(
                                                        function="equals",
                                                        initializers=None,
                                                        parameters=[
                                                            Column(
                                                                name="metric_id",
                                                                entity=None,
                                                                subscriptable=None,
                                                                key=None,
                                                            ),
                                                            9223372036854775909,
                                                        ],
                                                        alias=None,
                                                    ),
                                                    Function(
                                                        function="equals",
                                                        initializers=None,
                                                        parameters=[
                                                            Column(
                                                                name="tags[427]",
                                                                entity=None,
                                                                subscriptable="tags",
                                                                key="427",
                                                            ),
                                                            429,
                                                        ],
                                                        alias=None,
                                                    ),
                                                ],
                                                alias=None,
                                            ),
                                        ],
                                        alias=None,
                                    ),
                                    2,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            )
                        ],
                        alias=None,
                    ),
                ],
                alias="apdex",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.75)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775914,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p75_measurements_cls",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="tpm",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.75)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775915,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p75_measurements_fid",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.75)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775910,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p75_measurements_fcp",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.75)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775911,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p75_measurements_lcp",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [18],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 37, 440461, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 37, 440461, tzinfo=pytz.utc),
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
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[
                    9223372036854775908,
                    9223372036854775909,
                    9223372036854775910,
                    9223372036854775911,
                    9223372036854775914,
                    9223372036854775915,
                ],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_sets"),
        "select": [
            Function(
                function="uniqIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775908,
                        ],
                        alias=None,
                    ),
                ],
                alias="count_unique_user",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="uniqIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="and",
                        initializers=None,
                        parameters=[
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775908,
                                ],
                                alias=None,
                            ),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="tags[440]",
                                        entity=None,
                                        subscriptable="tags",
                                        key="440",
                                    ),
                                    429,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="count_miserable_user",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="plus",
                        initializers=None,
                        parameters=[
                            Function(
                                function="uniqIf",
                                initializers=None,
                                parameters=[
                                    Column(name="value", entity=None, subscriptable=None, key=None),
                                    Function(
                                        function="and",
                                        initializers=None,
                                        parameters=[
                                            Function(
                                                function="equals",
                                                initializers=None,
                                                parameters=[
                                                    Column(
                                                        name="metric_id",
                                                        entity=None,
                                                        subscriptable=None,
                                                        key=None,
                                                    ),
                                                    9223372036854775908,
                                                ],
                                                alias=None,
                                            ),
                                            Function(
                                                function="equals",
                                                initializers=None,
                                                parameters=[
                                                    Column(
                                                        name="tags[440]",
                                                        entity=None,
                                                        subscriptable="tags",
                                                        key="440",
                                                    ),
                                                    429,
                                                ],
                                                alias=None,
                                            ),
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias="count_miserable_user",
                            ),
                            5.8875,
                        ],
                        alias=None,
                    ),
                    Function(
                        function="plus",
                        initializers=None,
                        parameters=[
                            Function(
                                function="nullIf",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="uniqIf",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="value",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            Function(
                                                function="equals",
                                                initializers=None,
                                                parameters=[
                                                    Column(
                                                        name="metric_id",
                                                        entity=None,
                                                        subscriptable=None,
                                                        key=None,
                                                    ),
                                                    9223372036854775908,
                                                ],
                                                alias=None,
                                            ),
                                        ],
                                        alias="count_unique_user",
                                    ),
                                    0,
                                ],
                                alias=None,
                            ),
                            117.75,
                        ],
                        alias=None,
                    ),
                ],
                alias="user_misery",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [18],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 37, 440461, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 37, 440461, tzinfo=pytz.utc),
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
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[
                    9223372036854775908,
                    9223372036854775909,
                    9223372036854775910,
                    9223372036854775911,
                    9223372036854775914,
                    9223372036854775915,
                ],
            ),
            Condition(
                lhs=Function(
                    function="tuple",
                    initializers=None,
                    parameters=[
                        Column(
                            name="tags[9223372036854776020]",
                            entity=None,
                            subscriptable="tags",
                            key="9223372036854776020",
                        ),
                        Function(
                            function="transform",
                            initializers=None,
                            parameters=[
                                Column(
                                    name="project_id", entity=None, subscriptable=None, key=None
                                ),
                                [18],
                                ["bar"],
                                "",
                            ],
                            alias="project",
                        ),
                    ],
                    alias=None,
                ),
                op=Op.IN,
                rhs=Function(
                    function="tuple", initializers=None, parameters=[(437, "bar")], alias=None
                ),
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="epm",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776010]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776010",
                ),
                alias="environment",
            ),
        ],
        "groupby": [
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [19],
                    ["bar"],
                    "",
                ],
                alias="project.name",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776010]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776010",
                ),
                alias="environment",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 37, 719279, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 37, 719279, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[19],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=20,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            AliasedExpression(
                exp=Column(
                    name="tags[" "9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.95)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p95",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="epm",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="equals",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="metric_id",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            9223372036854775909,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="notIn",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="tags[9223372036854776021]",
                                                entity=None,
                                                subscriptable="tags",
                                                key="9223372036854776021",
                                            ),
                                            [
                                                9223372036854776028,
                                                9223372036854776027,
                                                9223372036854776029,
                                            ],
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="failure_rate",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            Function(
                function="in",
                initializers=None,
                parameters=[
                    (
                        Column(name="project_id", entity=None, subscriptable=None, key=None),
                        Column(
                            name="tags[9223372036854776020]",
                            entity=None,
                            subscriptable="tags",
                            key="9223372036854776020",
                        ),
                    ),
                    [(20, 487)],
                ],
                alias="team_key_transaction",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [20],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 38, 32475, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 38, 32475, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[20],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=21,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [
            OrderBy(
                exp=Function(
                    function="in",
                    initializers=None,
                    parameters=[
                        (
                            Column(name="project_id", entity=None, subscriptable=None, key=None),
                            Column(
                                name="tags[9223372036854776020]",
                                entity=None,
                                subscriptable="tags",
                                key="9223372036854776020",
                            ),
                        ),
                        [(20, 487)],
                    ],
                    alias="team_key_transaction",
                ),
                direction=Direction.ASC,
            ),
            OrderBy(
                exp=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.95)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p95",
                ),
                direction=Direction.ASC,
            ),
        ],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.95)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p95",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="epm",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="equals",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="metric_id",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            9223372036854775909,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="notIn",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="tags[9223372036854776021]",
                                                entity=None,
                                                subscriptable="tags",
                                                key="9223372036854776021",
                                            ),
                                            [
                                                9223372036854776028,
                                                9223372036854776027,
                                                9223372036854776029,
                                            ],
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="failure_rate",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            Function(
                function="in",
                initializers=None,
                parameters=[
                    (
                        Column(name="project_id", entity=None, subscriptable=None, key=None),
                        Column(
                            name="tags[9223372036854776020]",
                            entity=None,
                            subscriptable="tags",
                            key="9223372036854776020",
                        ),
                    ),
                    [(20, 487)],
                ],
                alias="team_key_transaction",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [20],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 38, 127281, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 38, 127281, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[20],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=21,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [
            OrderBy(
                exp=Function(
                    function="in",
                    initializers=None,
                    parameters=[
                        (
                            Column(name="project_id", entity=None, subscriptable=None, key=None),
                            Column(
                                name="tags[9223372036854776020]",
                                entity=None,
                                subscriptable="tags",
                                key="9223372036854776020",
                            ),
                        ),
                        [(20, 487)],
                    ],
                    alias="team_key_transaction",
                ),
                direction=Direction.ASC,
            ),
            OrderBy(
                exp=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.95)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p95",
                ),
                direction=Direction.ASC,
            ),
        ],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            AliasedExpression(
                exp=Column(
                    name="tags[" "9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.95)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p95",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="epm",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="equals",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="metric_id",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            9223372036854775909,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="notIn",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="tags[9223372036854776021]",
                                                entity=None,
                                                subscriptable="tags",
                                                key="9223372036854776021",
                                            ),
                                            [
                                                9223372036854776028,
                                                9223372036854776027,
                                                9223372036854776029,
                                            ],
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="failure_rate",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            Function(
                function="in",
                initializers=None,
                parameters=[
                    (
                        Column(name="project_id", entity=None, subscriptable=None, key=None),
                        Column(
                            name="tags[9223372036854776020]",
                            entity=None,
                            subscriptable="tags",
                            key="9223372036854776020",
                        ),
                    ),
                    [(21, 508), (21, 512)],
                ],
                alias="team_key_transaction",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [21],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 38, 458313, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 38, 458313, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[21],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=22,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [
            OrderBy(
                exp=Function(
                    function="in",
                    initializers=None,
                    parameters=[
                        (
                            Column(name="project_id", entity=None, subscriptable=None, key=None),
                            Column(
                                name="tags[9223372036854776020]",
                                entity=None,
                                subscriptable="tags",
                                key="9223372036854776020",
                            ),
                        ),
                        [(21, 508), (21, 512)],
                    ],
                    alias="team_key_transaction",
                ),
                direction=Direction.ASC,
            ),
            OrderBy(
                exp=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.95)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p95",
                ),
                direction=Direction.ASC,
            ),
        ],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.95)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p95",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="epm",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="equals",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="metric_id",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            9223372036854775909,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="notIn",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="tags[9223372036854776021]",
                                                entity=None,
                                                subscriptable="tags",
                                                key="9223372036854776021",
                                            ),
                                            [
                                                9223372036854776028,
                                                9223372036854776027,
                                                9223372036854776029,
                                            ],
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="failure_rate",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            Function(
                function="in",
                initializers=None,
                parameters=[
                    (
                        Column(name="project_id", entity=None, subscriptable=None, key=None),
                        Column(
                            name="tags[9223372036854776020]",
                            entity=None,
                            subscriptable="tags",
                            key="9223372036854776020",
                        ),
                    ),
                    [(21, 508), (21, 512)],
                ],
                alias="team_key_transaction",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [21],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 38, 552260, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 38, 552260, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[21],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=22,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [
            OrderBy(
                exp=Function(
                    function="in",
                    initializers=None,
                    parameters=[
                        (
                            Column(name="project_id", entity=None, subscriptable=None, key=None),
                            Column(
                                name="tags[9223372036854776020]",
                                entity=None,
                                subscriptable="tags",
                                key="9223372036854776020",
                            ),
                        ),
                        [(21, 508), (21, 512)],
                    ],
                    alias="team_key_transaction",
                ),
                direction=Direction.DESC,
            ),
            OrderBy(
                exp=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.95)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p95",
                ),
                direction=Direction.ASC,
            ),
        ],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.95)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p95",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="epm",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="equals",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="metric_id",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            9223372036854775909,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="notIn",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="tags[9223372036854776021]",
                                                entity=None,
                                                subscriptable="tags",
                                                key="9223372036854776021",
                                            ),
                                            [
                                                9223372036854776028,
                                                9223372036854776027,
                                                9223372036854776029,
                                            ],
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="failure_rate",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            Function(
                function="in",
                initializers=None,
                parameters=[
                    (
                        Column(name="project_id", entity=None, subscriptable=None, key=None),
                        Column(
                            name="tags[9223372036854776020]",
                            entity=None,
                            subscriptable="tags",
                            key="9223372036854776020",
                        ),
                    ),
                    [(22, 533), (22, 537)],
                ],
                alias="team_key_transaction",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [22],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Function(
                    function="in",
                    initializers=None,
                    parameters=[
                        (
                            Column(name="project_id", entity=None, subscriptable=None, key=None),
                            Column(
                                name="tags[9223372036854776020]",
                                entity=None,
                                subscriptable="tags",
                                key="9223372036854776020",
                            ),
                        ),
                        [(22, 533), (22, 537)],
                    ],
                    alias="team_key_transaction",
                ),
                op=Op.NEQ,
                rhs=0,
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 38, 893701, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 38, 893701, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[22],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=23,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [
            OrderBy(
                exp=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.95)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p95",
                ),
                direction=Direction.ASC,
            )
        ],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.95)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p95",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="epm",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="equals",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="metric_id",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            9223372036854775909,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="notIn",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="tags[9223372036854776021]",
                                                entity=None,
                                                subscriptable="tags",
                                                key="9223372036854776021",
                                            ),
                                            [
                                                9223372036854776028,
                                                9223372036854776027,
                                                9223372036854776029,
                                            ],
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="failure_rate",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            Function(
                function="in",
                initializers=None,
                parameters=[
                    (
                        Column(name="project_id", entity=None, subscriptable=None, key=None),
                        Column(
                            name="tags[9223372036854776020]",
                            entity=None,
                            subscriptable="tags",
                            key="9223372036854776020",
                        ),
                    ),
                    [(22, 533), (22, 537)],
                ],
                alias="team_key_transaction",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [22],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Function(
                    function="in",
                    initializers=None,
                    parameters=[
                        (
                            Column(name="project_id", entity=None, subscriptable=None, key=None),
                            Column(
                                name="tags[9223372036854776020]",
                                entity=None,
                                subscriptable="tags",
                                key="9223372036854776020",
                            ),
                        ),
                        [(22, 533), (22, 537)],
                    ],
                    alias="team_key_transaction",
                ),
                op=Op.EQ,
                rhs=1,
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 38, 987457, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 38, 987457, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[22],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=23,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [
            OrderBy(
                exp=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.95)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p95",
                ),
                direction=Direction.ASC,
            )
        ],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            AliasedExpression(
                exp=Column(
                    name="tags[" "9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.95)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p95",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="epm",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="equals",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="metric_id",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            9223372036854775909,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="notIn",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="tags[9223372036854776021]",
                                                entity=None,
                                                subscriptable="tags",
                                                key="9223372036854776021",
                                            ),
                                            [
                                                9223372036854776028,
                                                9223372036854776027,
                                                9223372036854776029,
                                            ],
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="failure_rate",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            Function(
                function="in",
                initializers=None,
                parameters=[
                    (
                        Column(name="project_id", entity=None, subscriptable=None, key=None),
                        Column(
                            name="tags[9223372036854776020]",
                            entity=None,
                            subscriptable="tags",
                            key="9223372036854776020",
                        ),
                    ),
                    [(22, 533), (22, 537)],
                ],
                alias="team_key_transaction",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [22],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Function(
                    function="in",
                    initializers=None,
                    parameters=[
                        (
                            Column(name="project_id", entity=None, subscriptable=None, key=None),
                            Column(
                                name="tags[9223372036854776020]",
                                entity=None,
                                subscriptable="tags",
                                key="9223372036854776020",
                            ),
                        ),
                        [(22, 533), (22, 537)],
                    ],
                    alias="team_key_transaction",
                ),
                op=Op.EQ,
                rhs=0,
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 39, 77835, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 39, 77835, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[22],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=23,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [
            OrderBy(
                exp=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.95)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p95",
                ),
                direction=Direction.ASC,
            )
        ],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.95)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p95",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="epm",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="equals",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="metric_id",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            9223372036854775909,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="notIn",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="tags[9223372036854776021]",
                                                entity=None,
                                                subscriptable="tags",
                                                key="9223372036854776021",
                                            ),
                                            [
                                                9223372036854776028,
                                                9223372036854776027,
                                                9223372036854776029,
                                            ],
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="failure_rate",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            Function(
                function="in",
                initializers=None,
                parameters=[
                    (
                        Column(name="project_id", entity=None, subscriptable=None, key=None),
                        Column(
                            name="tags[9223372036854776020]",
                            entity=None,
                            subscriptable="tags",
                            key="9223372036854776020",
                        ),
                    ),
                    [(22, 533), (22, 537)],
                ],
                alias="team_key_transaction",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [22],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Function(
                    function="in",
                    initializers=None,
                    parameters=[
                        (
                            Column(name="project_id", entity=None, subscriptable=None, key=None),
                            Column(
                                name="tags[9223372036854776020]",
                                entity=None,
                                subscriptable="tags",
                                key="9223372036854776020",
                            ),
                        ),
                        [(22, 533), (22, 537)],
                    ],
                    alias="team_key_transaction",
                ),
                op=Op.EQ,
                rhs=0,
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 39, 170133, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 39, 170133, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[22],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=23,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [
            OrderBy(
                exp=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.95)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p95",
                ),
                direction=Direction.ASC,
            )
        ],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.5)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p50",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="title",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="title",
            )
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 39, 419992, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 39, 419992, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[23],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=24,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
    {
        "match": Entity("metrics_distributions"),
        "select": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.95)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p95",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide", initializers=None, parameters=[7776000.0, 60], alias=None
                    ),
                ],
                alias="epm",
            ),
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="equals",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="metric_id",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            9223372036854775909,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="notIn",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="tags[9223372036854776021]",
                                                entity=None,
                                                subscriptable="tags",
                                                key="9223372036854776021",
                                            ),
                                            [
                                                9223372036854776028,
                                                9223372036854776027,
                                                9223372036854776029,
                                            ],
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="failure_rate",
            ),
        ],
        "groupby": [
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776021]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776021",
                ),
                alias="transaction.status",
            ),
            Function(
                function="in",
                initializers=None,
                parameters=[
                    (
                        Column(name="project_id", entity=None, subscriptable=None, key=None),
                        Column(
                            name="tags[9223372036854776020]",
                            entity=None,
                            subscriptable="tags",
                            key="9223372036854776020",
                        ),
                    ),
                    [(24, 592)],
                ],
                alias="team_key_transaction",
            ),
            AliasedExpression(
                exp=Column(
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                alias="transaction",
            ),
            Function(
                function="transform",
                initializers=None,
                parameters=[
                    Column(name="project_id", entity=None, subscriptable=None, key=None),
                    [24],
                    ["bar"],
                    "",
                ],
                alias="project",
            ),
        ],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 11, 11, 39, 719119, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 11, 11, 39, 719119, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[24],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=25,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [
            OrderBy(
                exp=Function(
                    function="arrayElement",
                    initializers=None,
                    parameters=[
                        Function(
                            function="quantilesIf(0.95)",
                            initializers=None,
                            parameters=[
                                Column(name="value", entity=None, subscriptable=None, key=None),
                                Function(
                                    function="equals",
                                    initializers=None,
                                    parameters=[
                                        Column(
                                            name="metric_id",
                                            entity=None,
                                            subscriptable=None,
                                            key=None,
                                        ),
                                        9223372036854775909,
                                    ],
                                    alias=None,
                                ),
                            ],
                            alias=None,
                        ),
                        1,
                    ],
                    alias="p95",
                ),
                direction=Direction.ASC,
            )
        ],
        "limitby": None,
        "limit": Limit(limit=51),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },  # Checked
]


series_queries = [
    Query(
        match=Entity("metrics_sets"),
        select=[
            Function(
                function="uniqIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775908,
                        ],
                        alias=None,
                    ),
                ],
                alias="count_unique_user",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
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
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775908],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=60),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="equals",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="metric_id",
                                                entity=None,
                                                subscriptable=None,
                                                key=None,
                                            ),
                                            9223372036854775909,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="notIn",
                                        initializers=None,
                                        parameters=[
                                            Column(
                                                name="tags[9223372036854776021]",
                                                entity=None,
                                                subscriptable="tags",
                                                key="9223372036854776021",
                                            ),
                                            [
                                                9223372036854776028,
                                                9223372036854776027,
                                                9223372036854776029,
                                            ],
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="failure_rate",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 16, 0, tzinfo=None),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[4],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=4,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=60),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide",
                        initializers=None,
                        parameters=[3600.0, 60],
                        alias=None,
                    ),
                ],
                alias="epm_3600",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 12, 0, tzinfo=pytz.utc),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[7],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=7,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=60),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide",
                        initializers=None,
                        parameters=[3600.0, 60],
                        alias=None,
                    ),
                ],
                alias="epm_3600",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 12, 0),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[7],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=7,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=60),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide",
                        initializers=None,
                        parameters=[3600.0, 60],
                        alias=None,
                    ),
                ],
                alias="epm_3600",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 12, 0),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[7],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=7,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=60),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide",
                        initializers=None,
                        parameters=[3600.0, 60],
                        alias=None,
                    ),
                ],
                alias="epm_3600",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
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
                    name="tags[9223372036854776020]",
                    entity=None,
                    subscriptable="tags",
                    key="9223372036854776020",
                ),
                op=Op.EQ,
                rhs=108,
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 12, 0),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[7],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=7,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=60),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.75)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p75_transaction_duration",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.75)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775911,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="p75_measurements_lcp",
            ),
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 16, 0),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[8],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=8,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909, 9223372036854775911],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=60),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="sumIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775909,
                        ],
                        alias=None,
                    ),
                ],
                alias="sum_transaction_duration",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 12, 0),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=9,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=60),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide",
                        initializers=None,
                        parameters=[86400.0, 60],
                        alias=None,
                    ),
                ],
                alias="epm_86400",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
                        parameters=[86400],
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 10, 0),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[10],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=10,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[86400],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=3600),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide",
                        initializers=None,
                        parameters=[86400.0, 60],
                        alias=None,
                    ),
                ],
                alias="tpm_86400",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
                        parameters=[86400],
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 10, 0),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[10],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=10,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[86400],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=3600),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide",
                        initializers=None,
                        parameters=[3600.0, 60],
                        alias=None,
                    ),
                ],
                alias="epm_3600",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 16, 0),
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
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=60),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide",
                        initializers=None,
                        parameters=[3600.0, 60],
                        alias=None,
                    ),
                ],
                alias="tpm_3600",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 16, 0),
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
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=60),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide",
                        initializers=None,
                        parameters=[3600.0, 60],
                        alias=None,
                    ),
                ],
                alias="tpm_3600",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 30),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 16, 30),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[12],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=12,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=60),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    Function(
                        function="divide",
                        initializers=None,
                        parameters=[3600.0, 60],
                        alias=None,
                    ),
                ],
                alias="epm_3600",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 30),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 16, 30),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[12],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=12,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[3600],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=60),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    60.0,
                ],
                alias="eps_60",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
                        parameters=[60],
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 10, 6),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[13],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=13,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[60],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=10),
        totals=None,
    ),
    Query(
        match=Entity("metrics_distributions"),
        select=[
            Function(
                function="divide",
                initializers=None,
                parameters=[
                    Function(
                        function="countIf",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id",
                                        entity=None,
                                        subscriptable=None,
                                        key=None,
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    60.0,
                ],
                alias="tps_60",
            )
        ],
        groupby=[
            Function(
                function="toStartOfInterval",
                initializers=None,
                parameters=[
                    Column(name="timestamp", entity=None, subscriptable=None, key=None),
                    Function(
                        function="toIntervalSecond",
                        initializers=None,
                        parameters=[60],
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
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 6, 21, 10, 0),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 21, 10, 6),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[13],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=13,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        having=[],
        orderby=[
            OrderBy(
                exp=Function(
                    function="toStartOfInterval",
                    initializers=None,
                    parameters=[
                        Column(name="timestamp", entity=None, subscriptable=None, key=None),
                        Function(
                            function="toIntervalSecond",
                            initializers=None,
                            parameters=[60],
                            alias=None,
                        ),
                        "Universal",
                    ],
                    alias="time",
                ),
                direction=Direction.ASC,
            )
        ],
        limitby=None,
        limit=Limit(limit=50),
        offset=None,
        granularity=Granularity(granularity=10),
        totals=None,
    ),
]


histogram_queries = [
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.75)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="percentile_transaction_duration_0_75",
            ),
            Function(
                function="arrayElement",
                initializers=None,
                parameters=[
                    Function(
                        function="quantilesIf(0.25)",
                        initializers=None,
                        parameters=[
                            Column(name="value", entity=None, subscriptable=None, key=None),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                    1,
                ],
                alias="percentile_transaction_duration_0_25",
            ),
            Function(
                function="maxIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775909,
                        ],
                        alias=None,
                    ),
                ],
                alias="max_transaction_duration",
            ),
            Function(
                function="minIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775909,
                        ],
                        alias=None,
                    ),
                ],
                alias="min_transaction_duration",
            ),
        ],
        "groupby": [],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 14, 52, 58, 52294),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 14, 52, 58, 52294),
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
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=1),
        "offset": None,
        "granularity": None,
        "totals": None,
    },
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="histogramIf(5)",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="and",
                        initializers=None,
                        parameters=[
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="greaterOrEquals",
                                        initializers=None,
                                        parameters=[
                                            Function(
                                                function="arrayReduce",
                                                initializers=None,
                                                parameters=[
                                                    "maxMerge",
                                                    [
                                                        Column(
                                                            name="max",
                                                            entity=None,
                                                            subscriptable=None,
                                                            key=None,
                                                        )
                                                    ],
                                                ],
                                                alias=None,
                                            ),
                                            0,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="lessOrEquals",
                                        initializers=None,
                                        parameters=[
                                            Function(
                                                function="arrayReduce",
                                                initializers=None,
                                                parameters=[
                                                    "minMerge",
                                                    [
                                                        Column(
                                                            name="min",
                                                            entity=None,
                                                            subscriptable=None,
                                                            key=None,
                                                        )
                                                    ],
                                                ],
                                                alias=None,
                                            ),
                                            5,
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="histogram_transaction_duration",
            )
        ],
        "groupby": [],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 14, 52, 58, 52294),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 14, 52, 58, 52294),
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
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=50),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="maxIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775909,
                        ],
                        alias=None,
                    ),
                ],
                alias="max_transaction_duration",
            ),
            Function(
                function="minIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775909,
                        ],
                        alias=None,
                    ),
                ],
                alias="min_transaction_duration",
            ),
        ],
        "groupby": [],
        "array_join": None,
        "where": [
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
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=1),
        "offset": None,
        "granularity": None,
        "totals": None,
    },
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="histogramIf(5)",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="and",
                        initializers=None,
                        parameters=[
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="greaterOrEquals",
                                        initializers=None,
                                        parameters=[
                                            Function(
                                                function="arrayReduce",
                                                initializers=None,
                                                parameters=[
                                                    "maxMerge",
                                                    [
                                                        Column(
                                                            name="max",
                                                            entity=None,
                                                            subscriptable=None,
                                                            key=None,
                                                        )
                                                    ],
                                                ],
                                                alias=None,
                                            ),
                                            0,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="lessOrEquals",
                                        initializers=None,
                                        parameters=[
                                            Function(
                                                function="arrayReduce",
                                                initializers=None,
                                                parameters=[
                                                    "minMerge",
                                                    [
                                                        Column(
                                                            name="min",
                                                            entity=None,
                                                            subscriptable=None,
                                                            key=None,
                                                        )
                                                    ],
                                                ],
                                                alias=None,
                                            ),
                                            5,
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775909,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="histogram_transaction_duration",
            )
        ],
        "groupby": [],
        "array_join": None,
        "where": [
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
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775909],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=50),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="maxIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775911,
                        ],
                        alias=None,
                    ),
                ],
                alias="max_measurements_lcp",
            ),
            Function(
                function="minIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775911,
                        ],
                        alias=None,
                    ),
                ],
                alias="min_measurements_lcp",
            ),
            Function(
                function="minIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775910,
                        ],
                        alias=None,
                    ),
                ],
                alias="min_measurements_fcp",
            ),
            Function(
                function="maxIf",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="equals",
                        initializers=None,
                        parameters=[
                            Column(name="metric_id", entity=None, subscriptable=None, key=None),
                            9223372036854775910,
                        ],
                        alias=None,
                    ),
                ],
                alias="max_measurements_fcp",
            ),
        ],
        "groupby": [],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 14, 52, 59, 880411),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 14, 52, 59, 880411),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[4],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=4,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775910, 9223372036854775911],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=1),
        "offset": None,
        "granularity": None,
        "totals": None,
    },
    {
        "match": Entity("metrics_distributions"),
        "select": [
            Function(
                function="histogramIf(2)",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="and",
                        initializers=None,
                        parameters=[
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="greaterOrEquals",
                                        initializers=None,
                                        parameters=[
                                            Function(
                                                function="arrayReduce",
                                                initializers=None,
                                                parameters=[
                                                    "maxMerge",
                                                    [
                                                        Column(
                                                            name="max",
                                                            entity=None,
                                                            subscriptable=None,
                                                            key=None,
                                                        )
                                                    ],
                                                ],
                                                alias=None,
                                            ),
                                            0,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="lessOrEquals",
                                        initializers=None,
                                        parameters=[
                                            Function(
                                                function="arrayReduce",
                                                initializers=None,
                                                parameters=[
                                                    "minMerge",
                                                    [
                                                        Column(
                                                            name="min",
                                                            entity=None,
                                                            subscriptable=None,
                                                            key=None,
                                                        )
                                                    ],
                                                ],
                                                alias=None,
                                            ),
                                            2,
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775910,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="histogram_measurements_fcp",
            ),
            Function(
                function="histogramIf(2)",
                initializers=None,
                parameters=[
                    Column(name="value", entity=None, subscriptable=None, key=None),
                    Function(
                        function="and",
                        initializers=None,
                        parameters=[
                            Function(
                                function="and",
                                initializers=None,
                                parameters=[
                                    Function(
                                        function="greaterOrEquals",
                                        initializers=None,
                                        parameters=[
                                            Function(
                                                function="arrayReduce",
                                                initializers=None,
                                                parameters=[
                                                    "maxMerge",
                                                    [
                                                        Column(
                                                            name="max",
                                                            entity=None,
                                                            subscriptable=None,
                                                            key=None,
                                                        )
                                                    ],
                                                ],
                                                alias=None,
                                            ),
                                            0,
                                        ],
                                        alias=None,
                                    ),
                                    Function(
                                        function="lessOrEquals",
                                        initializers=None,
                                        parameters=[
                                            Function(
                                                function="arrayReduce",
                                                initializers=None,
                                                parameters=[
                                                    "minMerge",
                                                    [
                                                        Column(
                                                            name="min",
                                                            entity=None,
                                                            subscriptable=None,
                                                            key=None,
                                                        )
                                                    ],
                                                ],
                                                alias=None,
                                            ),
                                            2,
                                        ],
                                        alias=None,
                                    ),
                                ],
                                alias=None,
                            ),
                            Function(
                                function="equals",
                                initializers=None,
                                parameters=[
                                    Column(
                                        name="metric_id", entity=None, subscriptable=None, key=None
                                    ),
                                    9223372036854775911,
                                ],
                                alias=None,
                            ),
                        ],
                        alias=None,
                    ),
                ],
                alias="histogram_measurements_lcp",
            ),
        ],
        "groupby": [],
        "array_join": None,
        "where": [
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.GTE,
                rhs=datetime.datetime(2022, 3, 24, 14, 52, 59, 880411),
            ),
            Condition(
                lhs=Column(name="timestamp", entity=None, subscriptable=None, key=None),
                op=Op.LT,
                rhs=datetime.datetime(2022, 6, 22, 14, 52, 59, 880411),
            ),
            Condition(
                lhs=Column(name="project_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[4],
            ),
            Condition(
                lhs=Column(name="org_id", entity=None, subscriptable=None, key=None),
                op=Op.EQ,
                rhs=4,
            ),
            Condition(
                lhs=Column(name="metric_id", entity=None, subscriptable=None, key=None),
                op=Op.IN,
                rhs=[9223372036854775910, 9223372036854775911],
            ),
        ],
        "having": [],
        "orderby": [],
        "limitby": None,
        "limit": Limit(limit=50),
        "offset": Offset(offset=0),
        "granularity": None,
        "totals": None,
    },
]
