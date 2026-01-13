from unittest import TestCase

import pytest
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    ExtrapolationMode,
    Function,
    IntArray,
    StrArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    OrFilter,
    TraceItemFilter,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams


class SearchResolverQueryTest(TestCase):
    def setUp(self) -> None:
        self.resolver = SearchResolver(
            params=SnubaParams(), config=SearchResolverConfig(), definitions=OURLOG_DEFINITIONS
        )

    def test_freetext_search_query(self) -> None:
        where, having, _ = self.resolver.resolve_query("foo")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_LIKE,
                value=AttributeValue(val_str="%foo%"),
            )
        )
        assert having is None

    def test_simple_query(self) -> None:
        where, having, _ = self.resolver.resolve_query("message:foo")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="foo"),
            )
        )
        assert having is None

    def test_negation(self) -> None:
        where, having, _ = self.resolver.resolve_query("!message:foo")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_EQUALS,
                value=AttributeValue(val_str="foo"),
            )
        )
        assert having is None

    def test_in_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query("message:[foo,bar,baz]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_str_array=StrArray(values=["foo", "bar", "baz"])),
            )
        )
        assert having is None

    def test_not_in_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query("!message:[foo,bar,baz]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_IN,
                value=AttributeValue(val_str_array=StrArray(values=["foo", "bar", "baz"])),
            )
        )
        assert having is None

    def test_in_numeric_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query("severity_number:[123,456,789]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.severity_number", type=AttributeKey.Type.TYPE_INT),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_int_array=IntArray(values=[123, 456, 789])),
            )
        )
        assert having is None

    def test_greater_than_numeric_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query("severity_number:>123")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.severity_number", type=AttributeKey.Type.TYPE_INT),
                op=ComparisonFilter.OP_GREATER_THAN,
                value=AttributeValue(val_int=123),
            )
        )
        assert having is None

    def test_query_with_and(self) -> None:
        where, having, _ = self.resolver.resolve_query("message:foo severity_text:bar")
        assert where == TraceItemFilter(
            and_filter=AndFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="sentry.body", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="foo"),
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="sentry.severity_text", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="bar"),
                        )
                    ),
                ]
            )
        )
        assert having is None

    def test_query_with_or(self) -> None:
        where, having, _ = self.resolver.resolve_query("message:foo or severity_text:bar")
        assert where == TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="sentry.body", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="foo"),
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="sentry.severity_text", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="bar"),
                        )
                    ),
                ]
            )
        )
        assert having is None

    def test_query_with_or_and_brackets(self) -> None:
        where, having, _ = self.resolver.resolve_query(
            "(message:123 and severity_text:345) or (message:foo and severity:bar)"
        )
        assert where == TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        and_filter=AndFilter(
                            filters=[
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=AttributeKey(
                                            name="sentry.body", type=AttributeKey.Type.TYPE_STRING
                                        ),
                                        op=ComparisonFilter.OP_EQUALS,
                                        value=AttributeValue(val_str="123"),
                                    )
                                ),
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=AttributeKey(
                                            name="sentry.severity_text",
                                            type=AttributeKey.Type.TYPE_STRING,
                                        ),
                                        op=ComparisonFilter.OP_EQUALS,
                                        value=AttributeValue(val_str="345"),
                                    )
                                ),
                            ]
                        )
                    ),
                    TraceItemFilter(
                        and_filter=AndFilter(
                            filters=[
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=AttributeKey(
                                            name="sentry.body", type=AttributeKey.Type.TYPE_STRING
                                        ),
                                        op=ComparisonFilter.OP_EQUALS,
                                        value=AttributeValue(val_str="foo"),
                                    )
                                ),
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=AttributeKey(
                                            name="sentry.severity_text",
                                            type=AttributeKey.Type.TYPE_STRING,
                                        ),
                                        op=ComparisonFilter.OP_EQUALS,
                                        value=AttributeValue(val_str="bar"),
                                    )
                                ),
                            ]
                        )
                    ),
                ]
            )
        )

    def test_empty_query(self) -> None:
        where, having, _ = self.resolver.resolve_query("")
        assert where is None
        assert having is None

    def test_none_query(self) -> None:
        where, having, _ = self.resolver.resolve_query(None)
        assert where is None
        assert having is None

    def test_bare_or_operator_in_parens(self) -> None:
        # Test for issue where ( OR ) creates a bare operator
        with pytest.raises(InvalidSearchQuery, match="Condition is missing on the left side"):
            self.resolver.resolve_query("( OR )")

    def test_bare_and_operator_in_parens(self) -> None:
        # Test for issue where ( AND ) creates a bare operator
        with pytest.raises(InvalidSearchQuery, match="Condition is missing on the left side"):
            self.resolver.resolve_query("( AND )")

    def test_bare_or_operator_with_valid_filter(self) -> None:
        # Test case from the issue - ( OR ) followed by valid filters
        with pytest.raises(InvalidSearchQuery, match="Condition is missing on the left side"):
            self.resolver.resolve_query("( OR ) message:foo")

    def test_empty_parens(self) -> None:
        # Test empty parentheses - should return None (no filters)
        where, having, _ = self.resolver.resolve_query("( )")
        assert where is None
        assert having is None


def test_count_default_argument() -> None:
    resolver = SearchResolver(
        params=SnubaParams(), config=SearchResolverConfig(), definitions=OURLOG_DEFINITIONS
    )
    resolved_column, virtual_context = resolver.resolve_column("count()")
    assert resolved_column.proto_definition == AttributeAggregation(
        aggregate=Function.FUNCTION_COUNT,
        key=AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT),
        label="count()",
        extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
    )
    assert virtual_context is None


@pytest.mark.parametrize(
    "function_name,proto_function",
    [
        ("count", Function.FUNCTION_COUNT),
        ("sum", Function.FUNCTION_SUM),
        ("avg", Function.FUNCTION_AVG),
        ("p50", Function.FUNCTION_P50),
        ("p75", Function.FUNCTION_P75),
        ("p90", Function.FUNCTION_P90),
        ("p95", Function.FUNCTION_P95),
        ("p99", Function.FUNCTION_P99),
        ("max", Function.FUNCTION_MAX),
        ("min", Function.FUNCTION_MIN),
    ],
)
def test_monoid_functions(function_name, proto_function) -> None:
    resolver = SearchResolver(
        params=SnubaParams(), config=SearchResolverConfig(), definitions=OURLOG_DEFINITIONS
    )
    for attr, proto_attr, proto_type in (
        ("severity_number", "sentry.severity_number", AttributeKey.Type.TYPE_INT),
        ("tags[user_attribute,number]", "user_attribute", AttributeKey.Type.TYPE_DOUBLE),
    ):
        resolved_column, virtual_context = resolver.resolve_column(f"{function_name}({attr})")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=proto_function,
            key=AttributeKey(name=proto_attr, type=proto_type),
            label=f"{function_name}({attr})",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None


@pytest.mark.parametrize(
    "test_case",
    [
        {
            "attribute_definition": OURLOG_DEFINITIONS.columns["observed_timestamp"],
            "search_term": 1234567890,
            "expected_value": AttributeValue(val_str="1234567890.0"),
            "expected_search_proto_type": AttributeKey.Type.TYPE_STRING,
        },
        {
            "attribute_definition": OURLOG_DEFINITIONS.columns["observed_timestamp"],
            "search_term": "1111111111",
            "expected_value": AttributeValue(val_str="1111111111.0"),
            "expected_search_proto_type": AttributeKey.Type.TYPE_STRING,
        },
        {
            "attribute_definition": OURLOG_DEFINITIONS.columns["payload_size"],
            "search_term": 1337,
            "expected_value": AttributeValue(val_double=1337),
            "expected_search_proto_type": AttributeKey.Type.TYPE_DOUBLE,
        },
    ],
)
def test_attribute_search(test_case) -> None:
    attribute_definition = test_case["attribute_definition"]
    search_term = test_case["search_term"]
    expected_value = test_case["expected_value"]
    expected_search_proto_type = test_case["expected_search_proto_type"]
    attribute_alias = attribute_definition.public_alias
    resolver = SearchResolver(
        params=SnubaParams(), config=SearchResolverConfig(), definitions=OURLOG_DEFINITIONS
    )
    query = f"{attribute_alias}:{search_term}"
    where, having, _ = resolver.resolve_query(query)

    assert where == TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=AttributeKey(
                name=attribute_definition.internal_name, type=expected_search_proto_type
            ),
            op=ComparisonFilter.OP_EQUALS,
            value=expected_value,
        )
    )
    assert having is None
