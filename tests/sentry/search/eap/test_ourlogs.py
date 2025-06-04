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

from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams


class SearchResolverQueryTest(TestCase):
    def setUp(self):
        self.resolver = SearchResolver(
            params=SnubaParams(), config=SearchResolverConfig(), definitions=OURLOG_DEFINITIONS
        )

    def test_freetext_search_query(self):
        where, having, _ = self.resolver.resolve_query("foo")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_LIKE,
                value=AttributeValue(val_str="%foo%"),
            )
        )
        assert having is None

    def test_simple_query(self):
        where, having, _ = self.resolver.resolve_query("message:foo")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="foo"),
            )
        )
        assert having is None

    def test_negation(self):
        where, having, _ = self.resolver.resolve_query("!message:foo")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_EQUALS,
                value=AttributeValue(val_str="foo"),
            )
        )
        assert having is None

    def test_in_filter(self):
        where, having, _ = self.resolver.resolve_query("message:[foo,bar,baz]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_str_array=StrArray(values=["foo", "bar", "baz"])),
            )
        )
        assert having is None

    def test_not_in_filter(self):
        where, having, _ = self.resolver.resolve_query("!message:[foo,bar,baz]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_IN,
                value=AttributeValue(val_str_array=StrArray(values=["foo", "bar", "baz"])),
            )
        )
        assert having is None

    def test_in_numeric_filter(self):
        where, having, _ = self.resolver.resolve_query("severity_number:[123,456,789]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.severity_number", type=AttributeKey.Type.TYPE_INT),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_int_array=IntArray(values=[123, 456, 789])),
            )
        )
        assert having is None

    def test_greater_than_numeric_filter(self):
        where, having, _ = self.resolver.resolve_query("severity_number:>123")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.severity_number", type=AttributeKey.Type.TYPE_INT),
                op=ComparisonFilter.OP_GREATER_THAN,
                value=AttributeValue(val_int=123),
            )
        )
        assert having is None

    def test_query_with_and(self):
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

    def test_query_with_or(self):
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

    def test_query_with_or_and_brackets(self):
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

    def test_empty_query(self):
        where, having, _ = self.resolver.resolve_query("")
        assert where is None
        assert having is None

    def test_none_query(self):
        where, having, _ = self.resolver.resolve_query(None)
        assert where is None
        assert having is None


def test_count_default_argument():
    resolver = SearchResolver(
        params=SnubaParams(), config=SearchResolverConfig(), definitions=OURLOG_DEFINITIONS
    )
    resolved_column, virtual_context = resolver.resolve_column("count()")
    assert resolved_column.proto_definition == AttributeAggregation(
        aggregate=Function.FUNCTION_COUNT,
        key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
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
def test_monoid_functions(function_name, proto_function):
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
