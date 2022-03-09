import unittest

import pytest
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE
from snuba_sdk.column import Column
from snuba_sdk.function import Function

from sentry import eventstore
from sentry.search.events.builder import UnresolvedQuery
from sentry.search.events.fields import (
    COMBINATORS,
    FUNCTIONS,
    FunctionDetails,
    InvalidSearchQuery,
    get_json_meta_type,
    parse_arguments,
    parse_combinator,
    parse_function,
    resolve_field_list,
)
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba import Dataset


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
        ("avg_duration", "", None, "duration"),
        ("duration", "Uint64", None, "duration"),
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
    assert get_json_meta_type(field_alias, snuba_type, function) == expected


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


class ResolveFieldListTest(unittest.TestCase):
    def test_non_string_field_error(self):
        fields = [["any", "thing", "lol"]]
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, eventstore.Filter())
        assert "Field names" in str(err)

    def test_tag_fields(self):
        fields = ["tags[test.foo:bar-123]"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            "tags[test.foo:bar-123]",
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]

    def test_invalid_tag_fields(self):
        for fields in [
            ["t[a]gs[test]"],
            ["t(a)gstest"],
            ["tags[te[s]t]"],
            ["tags[test]tags[test]"],
        ]:
            with pytest.raises(InvalidSearchQuery) as err:
                resolve_field_list(fields, eventstore.Filter())
            assert "Invalid character" in str(err)

    def test_blank_field_ignored(self):
        fields = ["", "title", "   "]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            "title",
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]

    def test_automatic_fields_no_aggregates(self):
        fields = ["event.type", "message"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            "event.type",
            "message",
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]
        assert result["aggregations"] == []
        assert result["groupby"] == []

    def test_field_alias_duration_expansion_with_brackets(self):
        fields = [
            "avg(transaction.duration)",
            "stddev(transaction.duration)",
            "latest_event()",
            "last_seen()",
            "apdex(300)",
            "count_miserable(user, 300)",
            "user_misery(300)",
            "percentile(transaction.duration, 0.75)",
            "percentile(transaction.duration, 0.95)",
            "percentile(transaction.duration, 0.99)",
            "percentile(transaction.duration, 0.995)",
            "percentile(transaction.duration, 0.99900)",
            "percentile(transaction.duration, 0.99999)",
        ]
        result = resolve_field_list(fields, eventstore.Filter())

        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["avg", "transaction.duration", "avg_transaction_duration"],
            ["stddevSamp", "transaction.duration", "stddev_transaction_duration"],
            ["argMax", ["id", "timestamp"], "latest_event"],
            ["max", "timestamp", "last_seen"],
            ["apdex(duration, 300)", None, "apdex_300"],
            [
                "uniqIf(user, greater(duration, 1200))",
                None,
                "count_miserable_user_300",
            ],
            [
                "ifNull(divide(plus(uniqIf(user, greater(duration, 1200)), 5.8875), plus(uniq(user), 117.75)), 0)",
                None,
                "user_misery_300",
            ],
            ["quantile(0.75)", "transaction.duration", "percentile_transaction_duration_0_75"],
            ["quantile(0.95)", "transaction.duration", "percentile_transaction_duration_0_95"],
            ["quantile(0.99)", "transaction.duration", "percentile_transaction_duration_0_99"],
            ["quantile(0.995)", "transaction.duration", "percentile_transaction_duration_0_995"],
            ["quantile(0.999)", "transaction.duration", "percentile_transaction_duration_0_99900"],
            [
                "quantile(0.99999)",
                "transaction.duration",
                "percentile_transaction_duration_0_99999",
            ],
        ]
        assert result["groupby"] == []

    def test_field_alias_expansion(self):
        fields = [
            "title",
            "last_seen()",
            "latest_event()",
            "project",
            "issue",
            "user.display",
            "message",
            "timestamp.to_hour",
            "timestamp.to_day",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            "title",
            "issue.id",
            ["coalesce", ["user.email", "user.username", "user.id", "user.ip"], "user.display"],
            "message",
            ["toStartOfHour", ["timestamp"], "timestamp.to_hour"],
            ["toStartOfDay", ["timestamp"], "timestamp.to_day"],
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "project",
            ],
        ]
        assert result["aggregations"] == [
            ["max", "timestamp", "last_seen"],
            ["argMax", ["id", "timestamp"], "latest_event"],
        ]
        assert result["groupby"] == [
            "title",
            "issue.id",
            ["coalesce", ["user.email", "user.username", "user.id", "user.ip"], "user.display"],
            "message",
            ["toStartOfHour", ["timestamp"], "timestamp.to_hour"],
            ["toStartOfDay", ["timestamp"], "timestamp.to_day"],
            "project.id",
        ]

    def test_field_alias_with_aggregates(self):
        fields = ["event.type", "user.display", "count_unique(title)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            "event.type",
            ["coalesce", ["user.email", "user.username", "user.id", "user.ip"], "user.display"],
        ]
        assert result["aggregations"] == [["uniq", "title", "count_unique_title"]]
        assert result["groupby"] == [
            "event.type",
            ["coalesce", ["user.email", "user.username", "user.id", "user.ip"], "user.display"],
        ]

    def test_aggregate_function_expansion(self):
        fields = ["count_unique(user)", "count(id)", "min(timestamp)", "identity(sessions)"]
        result = resolve_field_list(fields, eventstore.Filter(), functions_acl=["identity"])
        # Automatic fields should be inserted, count() should have its column dropped.
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["uniq", "user", "count_unique_user"],
            ["count", None, "count_id"],
            ["min", "timestamp", "min_timestamp"],
            ["identity", "sessions", "identity_sessions"],
        ]
        assert result["groupby"] == []

    def test_aggregate_function_complex_field_expansion(self):
        fields = ["count_unique(user.display)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            [
                "uniq",
                [["coalesce", ["user.email", "user.username", "user.id", "user.ip"]]],
                "count_unique_user_display",
            ],
        ]
        assert result["groupby"] == []

    def test_count_function_expansion(self):
        fields = ["count(id)", "count(user)", "count(transaction.duration)"]
        result = resolve_field_list(fields, eventstore.Filter())
        # Automatic fields should be inserted, count() should have its column dropped.
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["count", None, "count_id"],
            ["count", None, "count_user"],
            ["count", None, "count_transaction_duration"],
        ]
        assert result["groupby"] == []

    def test_aggregate_function_dotted_argument(self):
        fields = ["count_unique(user.id)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            ["uniq", "user.id", "count_unique_user_id"],
        ]

    def test_aggregate_function_invalid_name(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["derp(user)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "derp(user) is not a valid function" in str(err)

    def test_aggregate_function_case_sensitive(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["MAX(user)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "MAX(user) is not a valid function" in str(err)

    def test_aggregate_function_invalid_column(self):
        with pytest.raises(InvalidSearchQuery) as exc_info:
            fields = ["min(message)"]
            resolve_field_list(fields, eventstore.Filter())

        exc = exc_info.value
        exc_str = f"{exc}"
        assert "min(message): column argument invalid: message is not a numeric column" == exc_str

    def test_aggregate_function_missing_parameter(self):
        with pytest.raises(InvalidSearchQuery) as exc_info:
            fields = ["count_unique()"]
            resolve_field_list(fields, eventstore.Filter())

        exc = exc_info.value
        exc_str = f"{exc}"
        assert "count_unique(): column argument invalid: a column is required" == exc_str

        with pytest.raises(InvalidSearchQuery):
            fields = ["count_unique(  )"]
            resolve_field_list(fields, eventstore.Filter())

    def test_percentile_function(self):
        fields = ["percentile(transaction.duration, 0.75)"]
        result = resolve_field_list(fields, eventstore.Filter())

        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["quantile(0.75)", "transaction.duration", "percentile_transaction_duration_0_75"],
        ]
        assert result["groupby"] == []

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(0.75)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "percentile(0.75): expected 2 argument(s)" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(0.75,)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "percentile(0.75,): expected 2 argument(s)" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(sanchez, 0.75)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "percentile(sanchez, 0.75): column argument invalid: sanchez is not a valid column"
            in str(err)
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(id, 0.75)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "percentile(id, 0.75): column argument invalid: id is not a numeric column" in str(
            err
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(transaction.duration, 75)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "percentile(transaction.duration, 75): percentile argument invalid: 75 must be less than 1"
            in str(err)
        )

    def test_epm_function(self):
        fields = ["epm(3600)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["divide(count(), divide(3600, 60))", None, "epm_3600"],
        ]
        assert result["groupby"] == []

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["epm(0)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "epm(0): interval argument invalid: 0 must be greater than or equal to 1" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["epm(-1)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "epm(-1): interval argument invalid: -1 must be greater than or equal to 1" in str(
            err
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["epm()"]
            resolve_field_list(fields, eventstore.Filter())
        assert "epm(): invalid arguments: function called without default" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["epm()"]
            resolve_field_list(fields, eventstore.Filter(start="abc", end="def"))
        assert "epm(): invalid arguments: function called with invalid default" in str(err)

        fields = ["epm()"]
        result = resolve_field_list(
            fields, eventstore.Filter(start=before_now(hours=2), end=before_now(hours=1))
        )
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["divide(count(), divide(3600, 60))", None, "epm"],
        ]
        assert result["groupby"] == []

    def test_stddev_function(self):
        fields = [
            "stddev(measurements.fcp)",
            "stddev(spans.browser)",
            "stddev(transaction.duration)",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            ["stddevSamp", "measurements.fcp", "stddev_measurements_fcp"],
            [
                "stddevSamp",
                "spans.browser",
                "stddev_spans_browser",
            ],
            ["stddevSamp", "transaction.duration", "stddev_transaction_duration"],
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["stddev(user.id)"]
            resolve_field_list(fields, eventstore.Filter())

        assert "user.id is not a numeric column" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["stddev()"]
            resolve_field_list(fields, eventstore.Filter())

        assert "stddev(): expected 1 argument(s)" in str(err)

    def test_cov_function(self):
        fields = [
            "cov(transaction.duration, measurements.fcp)",
            "cov(transaction.duration, spans.browser)",
            "cov(transaction.duration, transaction.duration)",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "covarSamp",
                ["transaction.duration", "measurements.fcp"],
                "cov_transaction_duration_measurements_fcp",
            ],
            [
                "covarSamp",
                ["transaction.duration", "spans.browser"],
                "cov_transaction_duration_spans_browser",
            ],
            [
                "covarSamp",
                ["transaction.duration", "transaction.duration"],
                "cov_transaction_duration_transaction_duration",
            ],
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["cov(user.display, timestamp)"]
            result = resolve_field_list(fields, eventstore.Filter())

        assert (
            "cov(user.display, timestamp): column1 argument invalid: user.display is not a numeric column"
            in str(err)
        )

    def test_corr_function(self):
        fields = [
            "corr(transaction.duration, measurements.fcp)",
            "corr(transaction.duration, spans.browser)",
            "corr(transaction.duration, transaction.duration)",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "corr",
                ["transaction.duration", "measurements.fcp"],
                "corr_transaction_duration_measurements_fcp",
            ],
            [
                "corr",
                ["transaction.duration", "spans.browser"],
                "corr_transaction_duration_spans_browser",
            ],
            [
                "corr",
                ["transaction.duration", "transaction.duration"],
                "corr_transaction_duration_transaction_duration",
            ],
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["corr(user.display, timestamp)"]
            result = resolve_field_list(fields, eventstore.Filter())

        assert (
            "corr(user.display, timestamp): column1 argument invalid: user.display is not a numeric column"
            in str(err)
        )

    def test_tpm_function_alias(self):
        """TPM should be functionally identical to EPM except in name"""
        fields = ["tpm()"]
        result = resolve_field_list(
            fields, eventstore.Filter(start=before_now(hours=2), end=before_now(hours=1))
        )
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["divide(count(), divide(3600, 60))", None, "tpm"],
        ]
        assert result["groupby"] == []

    def test_eps_function(self):
        fields = ["eps(3600)"]
        result = resolve_field_list(fields, eventstore.Filter())

        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["divide(count(), 3600)", None, "eps_3600"],
        ]
        assert result["groupby"] == []

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["eps(0)"]
            result = resolve_field_list(fields, eventstore.Filter())
        assert "eps(0): interval argument invalid: 0 must be greater than or equal to 1" in str(err)

    def test_array_join_function(self):
        fields = [
            "array_join(tags.key)",
            "array_join(tags.value)",
            "array_join(measurements_key)",
            "array_join(span_op_breakdowns_key)",
        ]
        result = resolve_field_list(fields, eventstore.Filter(), functions_acl=["array_join"])
        assert result["selected_columns"] == [
            ["arrayJoin", ["tags.key"], "array_join_tags_key"],
            ["arrayJoin", ["tags.value"], "array_join_tags_value"],
            ["arrayJoin", ["measurements_key"], "array_join_measurements_key"],
            ["arrayJoin", ["span_op_breakdowns_key"], "array_join_span_op_breakdowns_key"],
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]

    def test_array_join_function_no_access(self):
        fields = ["array_join(tags.key)"]
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, eventstore.Filter())
        assert "no access to private function" in str(err)

    def test_histogram_function(self):
        fields = ["histogram(measurements_value, 10, 5, 1)"]
        result = resolve_field_list(fields, eventstore.Filter(), functions_acl=["histogram"])
        assert result["selected_columns"] == [
            [
                "plus",
                [
                    [
                        "multiply",
                        [
                            [
                                "floor",
                                [
                                    [
                                        "divide",
                                        [
                                            [
                                                "minus",
                                                [
                                                    [
                                                        "multiply",
                                                        [["arrayJoin", ["measurements_value"]], 1],
                                                    ],
                                                    5,
                                                ],
                                            ],
                                            10,
                                        ],
                                    ]
                                ],
                            ],
                            10,
                        ],
                    ],
                    5,
                ],
                "histogram_measurements_value_10_5_1",
            ],
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]

    def test_histogram_function_op_breakdowns(self):
        fields = ["histogram(span_op_breakdowns_value, 10, 5, 1)"]
        result = resolve_field_list(fields, eventstore.Filter(), functions_acl=["histogram"])
        assert result["selected_columns"] == [
            [
                "plus",
                [
                    [
                        "multiply",
                        [
                            [
                                "floor",
                                [
                                    [
                                        "divide",
                                        [
                                            [
                                                "minus",
                                                [
                                                    [
                                                        "multiply",
                                                        [
                                                            [
                                                                "arrayJoin",
                                                                ["span_op_breakdowns_value"],
                                                            ],
                                                            1,
                                                        ],
                                                    ],
                                                    5,
                                                ],
                                            ],
                                            10,
                                        ],
                                    ]
                                ],
                            ],
                            10,
                        ],
                    ],
                    5,
                ],
                "histogram_span_op_breakdowns_value_10_5_1",
            ],
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]

    def test_histogram_function_no_access(self):
        fields = ["histogram(measurements_value, 10, 5, 1)"]
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, eventstore.Filter())
        assert "no access to private function" in str(err)

    def test_count_at_least_function(self):
        fields = ["count_at_least(measurements.baz, 1000)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [["greaterOrEquals", ["measurements.baz", 1000]]],
                "count_at_least_measurements_baz_1000",
            ]
        ]

    def test_percentile_range(self):
        fields = [
            "percentile_range(transaction.duration, 0.5, greater, 2020-05-03T06:48:57) as percentile_range_1"
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "quantileIf(0.50)",
                [
                    "transaction.duration",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "percentile_range_1",
            ]
        ]
        # Test a non duration field
        fields = [
            "percentile_range(measurements.lcp, 0.5, greater, 2020-05-03T06:48:57) as avg_range_1"
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "quantileIf(0.50)",
                [
                    "measurements.lcp",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "avg_range_1",
            ]
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile_range(transaction.duration, 0.5, greater, tomorrow)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: tomorrow is in the wrong format" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile_range(transaction.duration, 0.5, lessOrEquals, today)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: today is in the wrong format" in str(err)

    def test_average_range(self):
        fields = ["avg_range(transaction.duration, greater, 2020-05-03T06:48:57) as avg_range_1"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "avgIf",
                [
                    "transaction.duration",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "avg_range_1",
            ]
        ]

        # Test a non duration field
        fields = ["avg_range(measurements.lcp, greater, 2020-05-03T06:48:57) as avg_range_1"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "avgIf",
                [
                    "measurements.lcp",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "avg_range_1",
            ]
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["avg_range(transaction.duration, greater, tomorrow)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: tomorrow is in the wrong format" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["avg_range(transaction.duration, lessOrEquals, today)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: today is in the wrong format" in str(err)

    def test_variance_range(self):
        fields = [
            "variance_range(transaction.duration, greater, 2020-05-03T06:48:57) as variance_range_1"
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "varSampIf",
                [
                    "transaction.duration",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "variance_range_1",
            ]
        ]

        # Test a non duration field
        fields = [
            "variance_range(measurements.lcp, greater, 2020-05-03T06:48:57) as variance_range_1"
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "varSampIf",
                [
                    "measurements.lcp",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "variance_range_1",
            ]
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["variance_range(transaction.duration, greater, tomorrow)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: tomorrow is in the wrong format" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["variance_range(transaction.duration, lessOrEquals, today)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: today is in the wrong format" in str(err)

    def test_count_range(self):
        fields = ["count_range(greater, 2020-05-03T06:48:57) as count_range_1"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]]],
                "count_range_1",
            ]
        ]

        # Test a non duration field
        fields = ["count_range(greater, 2020-05-03T06:48:57) as count_range_1"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]]],
                "count_range_1",
            ]
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["count_range(greater, tomorrow)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: tomorrow is in the wrong format" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["count_range(lessOrEquals, today)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: today is in the wrong format" in str(err)

    def test_count_if(self):
        fields = [
            "count_if(event.type,equals,transaction)",
            'count_if(event.type,notEquals,"transaction")',
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [["equals", ["event.type", "'transaction'"]]],
                "count_if_event_type_equals_transaction",
            ],
            [
                "countIf",
                [["notEquals", ["event.type", "'transaction'"]]],
                "count_if_event_type_notEquals__transaction",
            ],
        ]

    def test_absolute_correlation(self):
        fields = ["absolute_correlation()"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "abs",
                [["corr", [["toUnixTimestamp", ["timestamp"]], "transaction.duration"]]],
                "absolute_correlation",
            ]
        ]

    def test_percentage(self):
        fields = [
            "percentile_range(transaction.duration, 0.95, greater, 2020-05-03T06:48:57) as percentile_range_1",
            "percentile_range(transaction.duration, 0.95, lessOrEquals, 2020-05-03T06:48:57) as percentile_range_2",
            "percentage(percentile_range_2, percentile_range_1) as trend_percentage",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "quantileIf(0.95)",
                [
                    "transaction.duration",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "percentile_range_1",
            ],
            [
                "quantileIf(0.95)",
                [
                    "transaction.duration",
                    ["lessOrEquals", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "percentile_range_2",
            ],
            [
                "if(greater(percentile_range_1,0),divide(percentile_range_2,percentile_range_1),null)",
                None,
                "trend_percentage",
            ],
        ]

    def test_minus(self):
        fields = [
            "percentile_range(transaction.duration, 0.95, greater, 2020-05-03T06:48:57) as percentile_range_1",
            "percentile_range(transaction.duration, 0.95, lessOrEquals, 2020-05-03T06:48:57) as percentile_range_2",
            "minus(percentile_range_2, percentile_range_1) as trend_difference",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "quantileIf(0.95)",
                [
                    "transaction.duration",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "percentile_range_1",
            ],
            [
                "quantileIf(0.95)",
                [
                    "transaction.duration",
                    ["lessOrEquals", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "percentile_range_2",
            ],
            ["minus", ["percentile_range_2", "percentile_range_1"], "trend_difference"],
        ]

    def test_invalid_alias(self):
        bad_function_aliases = [
            "count() as ",
            "count() as as as as as",
            "count() as count(",
            "count() as 123",
            "count() as 1",
        ]
        for function in bad_function_aliases:
            with pytest.raises(InvalidSearchQuery) as err:
                resolve_field_list([function], eventstore.Filter())
            assert "Invalid characters in field" in str(err)

    def test_valid_alias(self):
        function_aliases = [
            ("count() as thecount", "thecount"),
            ("count() AS thecount", "thecount"),
            ("count() AS 123count", "123count"),
            ("count() AS count123", "count123"),
            ("count() AS c", "c"),
            ("count() AS c1", "c1"),
            ("count() AS 1c", "1c"),
        ]
        for function, alias in function_aliases:
            result = resolve_field_list([function], eventstore.Filter())
            assert result["aggregations"][0][-1] == alias, function

    def test_percentile_shortcuts(self):
        columns = [
            "",  # test default value
            "transaction.duration",
            "measurements.fp",
            "measurements.fcp",
            "measurements.lcp",
            "measurements.fid",
            "measurements.bar",
            "spans.browser",
        ]

        for column in columns:
            # if no column then use transaction.duration
            snuba_column = column if column else "transaction.duration"
            column_alias = column.replace(".", "_")

            fields = [
                field.format(column)
                for field in ["p50({})", "p75({})", "p95({})", "p99({})", "p100({})"]
            ]
            result = resolve_field_list(fields, eventstore.Filter())

            assert result["aggregations"] == [
                ["quantile(0.5)", snuba_column, f"p50_{column_alias}".strip("_")],
                ["quantile(0.75)", snuba_column, f"p75_{column_alias}".strip("_")],
                ["quantile(0.95)", snuba_column, f"p95_{column_alias}".strip("_")],
                ["quantile(0.99)", snuba_column, f"p99_{column_alias}".strip("_")],
                ["max", snuba_column, f"p100_{column_alias}".strip("_")],
            ]

    def test_compare_numeric_aggregate(self):
        fields = [
            "compare_numeric_aggregate(p50_transaction_duration,greater,50)",
            "compare_numeric_aggregate(p50_transaction_duration,notEquals,50)",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "greater(p50_transaction_duration,50.0)",
                None,
                "compare_numeric_aggregate_p50_transaction_duration_greater_50",
            ],
            [
                "notEquals(p50_transaction_duration,50.0)",
                None,
                "compare_numeric_aggregate_p50_transaction_duration_notEquals_50",
            ],
        ]

    def test_invalid_compare_numeric_aggregate(self):
        fields = [
            "compare_numeric_aggregate(p50_transaction_duration,>+,50)",
            "compare_numeric_aggregate(p50_transaction_duration,=,50)",
        ]
        for field in fields:
            with pytest.raises(InvalidSearchQuery) as err:
                resolve_field_list([field], eventstore.Filter())
            assert "is not a valid condition" in str(err), field

        fields = [
            "compare_numeric_aggregate(p50_tr(where,=,50)",
            "compare_numeric_aggregate(a.b.c.d,=,50)",
        ]
        for field in fields:
            with pytest.raises(InvalidSearchQuery) as err:
                resolve_field_list([field], eventstore.Filter())
            assert "is not a valid function alias" in str(err), field

    def test_rollup_with_unaggregated_fields(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["message"]
            resolve_field_list(fields, eventstore.Filter(rollup=15))
        assert "rollup without an aggregate" in str(err)

    def test_rollup_with_basic_and_aggregated_fields(self):
        fields = ["message", "count()"]
        result = resolve_field_list(fields, eventstore.Filter(rollup=15))

        assert result["aggregations"] == [["count", None, "count"]]
        assert result["selected_columns"] == ["message"]
        assert result["groupby"] == ["message"]

    def test_rollup_with_aggregated_fields(self):
        fields = ["count_unique(user)"]
        result = resolve_field_list(fields, eventstore.Filter(rollup=15))
        assert result["aggregations"] == [["uniq", "user", "count_unique_user"]]
        assert result["selected_columns"] == []
        assert result["groupby"] == []

    def test_orderby_unselected_field(self):
        fields = ["message"]
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, eventstore.Filter(orderby="timestamp"))
        assert "Cannot sort" in str(err)

    def test_orderby_basic_field(self):
        fields = ["message"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-message"))
        assert result["selected_columns"] == [
            "message",
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]
        assert result["aggregations"] == []
        assert result["groupby"] == []

    def test_orderby_field_aggregate(self):
        """When there's only aggregates don't sort"""
        fields = ["count(id)", "count_unique(user)"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-count(id)"))
        assert result["orderby"] is None
        assert result["aggregations"] == [
            ["count", None, "count_id"],
            ["uniq", "user", "count_unique_user"],
        ]
        assert result["groupby"] == []

    def test_orderby_field_aggregate_only(self):
        fields = ["transaction.name", "count(id)", "count_unique(user)"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-count(id)"))
        assert result["orderby"] == ["-count_id"]
        assert result["aggregations"] == [
            ["count", None, "count_id"],
            ["uniq", "user", "count_unique_user"],
        ]
        assert result["groupby"] == ["transaction.name"]

    def test_orderby_issue_alias(self):
        fields = ["issue"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-issue"))
        assert result["orderby"] == ["-issue.id"]
        assert result["selected_columns"] == [
            "issue.id",
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]
        assert result["aggregations"] == []
        assert result["groupby"] == []

    def test_orderby_project_alias(self):
        fields = ["project"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-project"))
        assert result["selected_columns"] == [
            "project.id",
            "id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "project",
            ],
        ]
        assert result["orderby"] == ["-project"]
        assert result["aggregations"] == []
        assert result["groupby"] == []

    def test_orderby_user_display_alias(self):
        fields = ["user.display"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-user.display"))
        assert result["selected_columns"] == [
            ["coalesce", ["user.email", "user.username", "user.id", "user.ip"], "user.display"],
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]
        assert result["orderby"] == ["-user.display"]
        assert result["aggregations"] == []
        assert result["groupby"] == []

    def test_resolves_functions_with_arguments(self):
        fields = [
            "count()",
            "p50()",
            "p50(transaction.duration)",
            "avg(measurements.foo)",
            "percentile(measurements.fcp, 0.5)",
            "stddev(measurements.foo)",
            "percentile(spans.browser, 0.5)",
            "avg(spans.total.time)",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        functions = result["functions"]

        assert functions["count"].instance.name == "count"
        assert functions["count"].arguments == {"column": None}

        assert functions["p50"].instance.name == "p50"
        assert functions["p50"].arguments == {"column": "transaction.duration"}

        assert functions["p50_transaction_duration"].instance.name == "p50"
        assert functions["p50_transaction_duration"].arguments == {"column": "transaction.duration"}

        assert functions["avg_measurements_foo"].instance.name == "avg"
        assert functions["avg_measurements_foo"].arguments == {"column": "measurements.foo"}

        assert functions["percentile_measurements_fcp_0_5"].instance.name == "percentile"
        assert functions["percentile_measurements_fcp_0_5"].arguments == {
            "column": "measurements.fcp",
            "percentile": 0.5,
        }

        assert functions["stddev_measurements_foo"].instance.name == "stddev"
        assert functions["stddev_measurements_foo"].arguments == {"column": "measurements.foo"}

        assert functions["percentile_spans_browser_0_5"].instance.name == "percentile"
        assert functions["percentile_spans_browser_0_5"].arguments == {
            "column": "spans.browser",
            "percentile": 0.5,
        }

        assert functions["avg_spans_total_time"].instance.name == "avg"
        assert functions["avg_spans_total_time"].arguments == {"column": "spans.total.time"}

    def test_to_other_function_basic(self):
        fields = [
            'to_other(release,"r")',
            'to_other(release,"r",a)',
            'to_other(release,"r",a,b)',
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        functions = result["functions"]

        assert functions["to_other_release__r"].instance.name == "to_other"
        assert functions["to_other_release__r"].arguments == {
            "column": "release",
            "value": "'r'",
            "that": "'that'",
            "this": "'this'",
        }

        assert functions["to_other_release__r__a"].instance.name == "to_other"
        assert functions["to_other_release__r__a"].arguments == {
            "column": "release",
            "value": "'r'",
            "that": "'a'",
            "this": "'this'",
        }

        assert functions["to_other_release__r__a_b"].instance.name == "to_other"
        assert functions["to_other_release__r__a_b"].arguments == {
            "column": "release",
            "value": "'r'",
            "that": "'a'",
            "this": "'b'",
        }

    def test_to_other_function_complex(self):
        fields = [
            'to_other(release,"release.version@1.2.3+4")',
            'to_other(release,"release +-  spaces   &    symbols :")',
            'to_other(release,"release\\"using\'quotes")',
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        functions = result["functions"]

        assert functions["to_other_release__release_version_1_2_3_4"].instance.name == "to_other"
        assert functions["to_other_release__release_version_1_2_3_4"].arguments == {
            "column": "release",
            "value": "'release.version@1.2.3+4'",
            "that": "'that'",
            "this": "'this'",
        }

        assert (
            functions["to_other_release__release_____spaces________symbols"].instance.name
            == "to_other"
        )
        assert functions["to_other_release__release_____spaces________symbols"].arguments == {
            "column": "release",
            "value": "'release +-  spaces   &    symbols :'",
            "that": "'that'",
            "this": "'this'",
        }

        assert functions["to_other_release__release__using_quotes"].instance.name == "to_other"
        assert functions["to_other_release__release__using_quotes"].arguments == {
            "column": "release",
            "value": "'release\"using'quotes'",
            "that": "'that'",
            "this": "'this'",
        }

    def test_to_other_validation(self):
        with self.assertRaises(InvalidSearchQuery):
            resolve_field_list(["to_other(release,a)"], eventstore.Filter())

        with self.assertRaises(InvalidSearchQuery):
            resolve_field_list(['to_other(release,"a)'], eventstore.Filter())

        with self.assertRaises(InvalidSearchQuery):
            resolve_field_list(['to_other(release,a")'], eventstore.Filter())

    def test_failure_count_function(self):
        fields = ["failure_count()"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [
                    [
                        "not",
                        [
                            [
                                "has",
                                [
                                    [
                                        "array",
                                        [
                                            SPAN_STATUS_NAME_TO_CODE[name]
                                            for name in ["ok", "cancelled", "unknown"]
                                        ],
                                    ],
                                    "transaction.status",
                                ],
                            ],
                        ],
                    ],
                ],
                "failure_count",
            ],
        ]

    def test_redundant_grouping_errors(self):
        fields = [
            ["last_seen()", "timestamp"],
            ["avg(measurements.lcp)", "measurements.lcp"],
            ["stddev(measurements.lcp)", "measurements.lcp"],
            ["avg(spans.browser)", "spans.browser"],
            ["stddev(spans.browser)", "spans.browser"],
            ["min(timestamp)", "timestamp"],
            ["max(timestamp)", "timestamp"],
            ["p95()", "transaction.duration"],
            ["any(measurements.fcp)", "measurements.fcp"],
            ["any(spans.browser)", "spans.browser"],
        ]
        for field in fields:
            with pytest.raises(InvalidSearchQuery) as error:
                resolve_field_list(field, eventstore.Filter())

            assert "you must first remove the function(s)" in str(error)

        with pytest.raises(InvalidSearchQuery) as error:
            resolve_field_list(
                ["avg(transaction.duration)", "p95()", "transaction.duration"], eventstore.Filter()
            )

        assert "avg(transaction.duration)" in str(error)
        assert "p95" in str(error)
        assert " more." not in str(error)

        with pytest.raises(InvalidSearchQuery) as error:
            resolve_field_list(
                [
                    "avg(transaction.duration)",
                    "p50()",
                    "p75()",
                    "p95()",
                    "p99()",
                    "transaction.duration",
                ],
                eventstore.Filter(),
            )

        assert "and 3 more" in str(error)

    def test_count_if_field_with_duration(self):
        fields = ["count_if(transaction.duration, less, 10)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [
                    [
                        "less",
                        ["transaction.duration", 10],
                    ],
                ],
                "count_if_transaction_duration_less_10",
            ],
        ]
        fields = ["count_if(spans.http, lessOrEquals, 100)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [
                    [
                        "lessOrEquals",
                        ["spans.http", 100],
                    ],
                ],
                "count_if_spans_http_lessOrEquals_100",
            ],
        ]
        fields = ["count_if(measurements.lcp, lessOrEquals, 10d)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [
                    [
                        "lessOrEquals",
                        ["measurements.lcp", 864000000],
                    ],
                ],
                "count_if_measurements_lcp_lessOrEquals_10d",
            ],
        ]

    def test_count_if_field_with_tag(self):
        fields = ["count_if(http.status_code, equals, 200)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [
                    [
                        "equals",
                        ["http.status_code", "'200'"],
                    ],
                ],
                "count_if_http_status_code_equals_200",
            ],
        ]

        fields = ["count_if(http.status_code, notEquals, 400)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [
                    [
                        "notEquals",
                        ["http.status_code", "'400'"],
                    ],
                ],
                "count_if_http_status_code_notEquals_400",
            ],
        ]

    def test_count_if_with_transaction_status(self):
        result = resolve_field_list(
            ["count_if(transaction.status, equals, ok)"], eventstore.Filter()
        )
        assert result["aggregations"] == [
            [
                "countIf",
                [
                    [
                        "equals",
                        ["transaction.status", 0],
                    ],
                ],
                "count_if_transaction_status_equals_ok",
            ],
        ]

        result = resolve_field_list(
            ["count_if(transaction.status, notEquals, ok)"], eventstore.Filter()
        )
        assert result["aggregations"] == [
            [
                "countIf",
                [
                    [
                        "notEquals",
                        ["transaction.status", 0],
                    ],
                ],
                "count_if_transaction_status_notEquals_ok",
            ],
        ]

    def test_invalid_count_if_fields(self):
        with self.assertRaises(InvalidSearchQuery) as query_error:
            resolve_field_list(
                ["count_if(transaction.duration, equals, sentry)"], eventstore.Filter()
            )
        assert (
            str(query_error.exception)
            == "'sentry' is not a valid value to compare with transaction.duration"
        )

        with self.assertRaises(InvalidSearchQuery) as query_error:
            resolve_field_list(
                ["count_if(transaction.duration, equals, 10wow)"], eventstore.Filter()
            )
        assert str(query_error.exception).startswith("wow is not a valid duration type")

        with self.assertRaises(InvalidSearchQuery) as query_error:
            resolve_field_list(["count_if(project, equals, sentry)"], eventstore.Filter())
        assert str(query_error.exception) == "project is not supported by count_if"

        with self.assertRaises(InvalidSearchQuery) as query_error:
            resolve_field_list(["count_if(stack.function, equals, test)"], eventstore.Filter())
        assert str(query_error.exception) == "stack.function is not supported by count_if"

        with self.assertRaises(InvalidSearchQuery) as query_error:
            resolve_field_list(
                ["count_if(transaction.status, equals, fakestatus)"], eventstore.Filter()
            )
        assert (
            str(query_error.exception) == "'fakestatus' is not a valid value for transaction.status"
        )


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
