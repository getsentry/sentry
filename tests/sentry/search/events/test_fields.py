import pytest
from snuba_sdk.column import Column
from snuba_sdk.function import Function

from sentry.search.events.builder import UnresolvedQuery
from sentry.search.events.fields import (
    COMBINATORS,
    FUNCTIONS,
    FunctionDetails,
    get_json_meta_type,
    parse_arguments,
    parse_combinator,
    parse_function,
)
from sentry.snuba.dataset import Dataset


@pytest.mark.parametrize(
    "field_alias,snuba_type,function,expected",
    [
        ("project_id", "UInt8", None, "boolean"),
        ("project_id", "UInt16", None, "integer"),
        ("project_id", "UInt32", None, "integer"),
        ("project_id", "UInt64", None, "integer"),
        ("project_id", "Float32", None, "number"),
        ("project_id", "Float64", None, "number"),
        ("value", "Nullable(Float64)", None, "number"),
        ("exception_stacks.type", "Array(String)", None, "array"),
        ("transaction", "Char", None, "string"),
        ("foo", "unknown", None, "string"),
        ("other", "", None, "string"),
        (
            "avg_transaction_duration",
            "Float64",
            FunctionDetails(
                "avg(transaction.duration)", FUNCTIONS["avg"], {"column": "transaction.duration"}
            ),
            "duration",
        ),
        ("duration", "UInt64", None, "integer"),
        ("p50", "Float32", None, "duration"),
        ("p75", "Float32", None, "duration"),
        ("p95", "Float32", None, "duration"),
        ("p99", "Float32", None, "duration"),
        ("p100", "Float32", None, "duration"),
        ("apdex_transaction_duration_300", "Float32", None, "number"),
        ("failure_rate", "Float32", None, "percentage"),
        ("count_miserable_user_300", "Float32", None, "integer"),
        ("user_misery_300", "Float32", None, "number"),
        ("percentile_transaction_duration_0_95", "Float32", None, "duration"),
        ("count_thing", "UInt64", None, "integer"),
        ("count_thing", "String", None, "string"),
        ("count_thing", "Nullable(String)", None, "string"),
        ("measurements.size", "Float64", None, "number"),
        ("measurements.fp", "Float64", None, "duration"),
        ("spans.browser", "Float64", None, "duration"),
        ("spans.total.time", "Float64", None, "duration"),
        (
            "percentile_measurements_foo_0_5",
            "Nullable(Float64)",
            FunctionDetails(
                "percentile(measurements.fp, 0.5)",
                FUNCTIONS["percentile"],
                {"column": "measurements.fp", "percentile": 0.5},
            ),
            "duration",
        ),
        (
            "percentile_measurements_foo_0_5",
            "Nullable(Float64)",
            FunctionDetails(
                "percentile(measurements.foo, 0.5)",
                FUNCTIONS["percentile"],
                {"column": "measurements.foo", "percentile": 0.5},
            ),
            "number",
        ),
        (
            "percentile_spans_fp_0_5",
            "Nullable(Float64)",
            FunctionDetails(
                "percentile(spans.fp, 0.5)",
                FUNCTIONS["percentile"],
                {"column": "spans.fp", "percentile": 0.5},
            ),
            "duration",
        ),
        (
            "percentile_spans_foo_0_5",
            "Nullable(Float64)",
            FunctionDetails(
                "percentile(spans.foo, 0.5)",
                FUNCTIONS["percentile"],
                {"column": "spans.foo", "percentile": 0.5},
            ),
            "duration",
        ),
        (
            "percentile_spans_total_time_0_5",
            "Nullable(Float64)",
            FunctionDetails(
                "percentile(spans.total.time, 0.5)",
                FUNCTIONS["percentile"],
                {"column": "spans.total.time", "percentile": 0.5},
            ),
            "duration",
        ),
    ],
)
def test_get_json_meta_type(field_alias, snuba_type, function, expected):
    qb = UnresolvedQuery(dataset=Dataset.Discover, params={})
    qb.function_alias_map[field_alias] = function
    assert get_json_meta_type(field_alias, snuba_type, qb) == expected, field_alias


@pytest.mark.parametrize(
    "function,expected",
    [
        (
            "percentile(transaction.duration, 0.5)",
            ("percentile", ["transaction.duration", "0.5"], None),
        ),
        ("p50()", ("p50", [], None)),
        ("p75(measurements.lcp)", ("p75", ["measurements.lcp"], None)),
        ("p75(spans.http)", ("p75", ["spans.http"], None)),
        ("p75(spans.total.time)", ("p75", ["spans.total.time"], None)),
        ("apdex(300)", ("apdex", ["300"], None)),
        ("failure_rate()", ("failure_rate", [], None)),
        (
            "histogram(measurements_value, 1,0,1)",
            ("histogram", ["measurements_value", "1", "0", "1"], None),
        ),
        (
            "histogram(spans_value, 1,0,1)",
            ("histogram", ["spans_value", "1", "0", "1"], None),
        ),
        (
            "count_unique(transaction.status)",
            ("count_unique", ["transaction.status"], None),
        ),
        ("count_unique(some.tag-name)", ("count_unique", ["some.tag-name"], None)),
        ("count()", ("count", [], None)),
        (
            "count_at_least(transaction.duration ,200)",
            ("count_at_least", ["transaction.duration", "200"], None),
        ),
        ("min(measurements.foo)", ("min", ["measurements.foo"], None)),
        (
            "avg_range(transaction.duration, 0.5, 2020-03-13T15:14:15, 2020-03-14T15:14:15) AS p",
            (
                "avg_range",
                ["transaction.duration", "0.5", "2020-03-13T15:14:15", "2020-03-14T15:14:15"],
                "p",
            ),
        ),
        (
            "t_test(avg_1, avg_2,var_1, var_2, count_1, count_2)",
            (
                "t_test",
                ["avg_1", "avg_2", "var_1", "var_2", "count_1", "count_2"],
                None,
            ),
        ),
        (
            "compare_numeric_aggregate(alias, greater,1234)",
            ("compare_numeric_aggregate", ["alias", "greater", "1234"], None),
        ),
        (
            r'to_other(release,"asdf @ \"qwer: (3,2)")',
            ("to_other", ["release", r'"asdf @ \"qwer: (3,2)"'], None),
        ),
        ("identity(sessions)", ("identity", ["sessions"], None)),
    ],
)
def test_parse_function(function, expected):
    assert parse_function(function) == expected


@pytest.mark.parametrize(
    "function,columns,result",
    [
        # pretty straight forward since its effectively a split on `,`
        ("func", "a,b,c", ["a", "b", "c"]),
        ("func", "a, b, c", ["a", "b", "c"]),
        # to_other and count_if support quotes so have special handling
        ("to_other", "a,b", ["a", "b"]),
        ("to_other", "a, b", ["a", "b"]),
        ("count_if", 'a, b, "c"', ["a", "b", '"c"']),
        ("count_if", 'a, b, "\\""', ["a", "b", '"\\""']),
        ("count_if", 'a, b, "\\test"', ["a", "b", '"\\test"']),
        ("count_if", 'a, b,","', ["a", "b", '","']),
    ],
)
def test_parse_arguments(function, columns, result):
    assert parse_arguments(function, columns) == result


@pytest.mark.parametrize(
    "function, expected",
    [
        pytest.param("func", ("func", None), id="no combinators"),
        pytest.param("funcArray", ("func", "Array"), id="-Array combinator"),
        pytest.param("funcarray", ("funcarray", None), id="is case sensitive"),
        pytest.param("func_array", ("func_array", None), id="does not accept snake case"),
    ],
)
def test_parse_combinator(function, expected):
    assert parse_combinator(function) == expected


def resolve_snql_fieldlist(fields):
    return UnresolvedQuery(Dataset.Discover, {}).resolve_select(fields, [])


@pytest.mark.parametrize(
    "field,expected",
    [
        (
            "percentile_range(transaction.duration, 0.5, greater, 2020-05-03T06:48:57) as percentile_range_1",
            Function(
                "quantileIf(0.50)",
                [
                    Column("duration"),
                    Function(
                        "greater",
                        [Function("toDateTime", ["2020-05-03T06:48:57"]), Column("timestamp")],
                    ),
                ],
                "percentile_range_1",
            ),
        ),
        (
            "avg_range(transaction.duration, greater, 2020-05-03T06:48:57) as avg_range_1",
            Function(
                "avgIf",
                [
                    Column("duration"),
                    Function(
                        "greater",
                        [Function("toDateTime", ["2020-05-03T06:48:57"]), Column("timestamp")],
                    ),
                ],
                "avg_range_1",
            ),
        ),
        (
            "variance_range(transaction.duration, greater, 2020-05-03T06:48:57) as variance_range_1",
            Function(
                "varSampIf",
                [
                    Column("duration"),
                    Function(
                        "greater",
                        [Function("toDateTime", ["2020-05-03T06:48:57"]), Column("timestamp")],
                    ),
                ],
                "variance_range_1",
            ),
        ),
        (
            "count_range(greater, 2020-05-03T06:48:57) as count_range_1",
            Function(
                "countIf",
                [
                    Function(
                        "greater",
                        [Function("toDateTime", ["2020-05-03T06:48:57"]), Column("timestamp")],
                    ),
                ],
                "count_range_1",
            ),
        ),
    ],
)
def test_range_funtions(field, expected):
    fields = resolve_snql_fieldlist([field])
    assert len(fields) == 1
    assert fields[0] == expected


@pytest.mark.parametrize("combinator", COMBINATORS)
def test_combinator_names_are_reserved(combinator):
    fields = UnresolvedQuery(dataset=Dataset.Discover, params={})
    for function in fields.function_converter:
        assert not function.endswith(
            combinator.kind
        ), f"Cannot name function `{function}` because `-{combinator.kind}` suffix is reserved for combinators"
