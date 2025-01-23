import pytest
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    AttributeValue,
    DoubleArray,
    StrArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    OrFilter,
    TraceItemFilter,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.ourlog_columns import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.testutils.cases import TestCase


class SearchResolverQueryTest(TestCase):
    def setUp(self):
        self.resolver = SearchResolver(
            params=SnubaParams(), config=SearchResolverConfig(), definitions=OURLOG_DEFINITIONS
        )

    def test_simple_query(self):
        where, having, _ = self.resolver.resolve_query("sentry.body:foo")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="foo"),
            )
        )
        assert having is None

    def test_negation(self):
        where, having, _ = self.resolver.resolve_query("!sentry.body:foo")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_EQUALS,
                value=AttributeValue(val_str="foo"),
            )
        )
        assert having is None

    def test_in_filter(self):
        where, having, _ = self.resolver.resolve_query("sentry.body:[foo,bar,baz]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_str_array=StrArray(values=["foo", "bar", "baz"])),
            )
        )
        assert having is None

    def test_hex_id_validation(self):
        where, having, _ = self.resolver.resolve_query(f"span_id:{'f'*16}")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.span_id", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="f" * 16),
            )
        )
        assert having is None

    def test_invalid_span_id_validation(self):
        with pytest.raises(InvalidSearchQuery):
            self.resolver.resolve_query("span_id:hello")

    def test_not_in_filter(self):
        where, having, _ = self.resolver.resolve_query("!log.body:[foo,bar,baz]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_IN,
                value=AttributeValue(val_str_array=StrArray(values=["foo", "bar", "baz"])),
            )
        )
        assert having is None

    def test_in_numeric_filter(self):
        where, having, _ = self.resolver.resolve_query("log.severity_number:[123,456,789]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.severity_number", type=AttributeKey.Type.TYPE_DOUBLE),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_double_array=DoubleArray(values=[123, 456, 789])),
            )
        )
        assert having is None

    def test_greater_than_numeric_filter(self):
        where, having, _ = self.resolver.resolve_query("log.severity_number:>123")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.severity_number", type=AttributeKey.Type.TYPE_DOUBLE),
                op=ComparisonFilter.OP_GREATER_THAN,
                value=AttributeValue(val_double=123),
            )
        )
        assert having is None

    def test_query_with_and(self):
        where, having, _ = self.resolver.resolve_query("log.body:foo log.severity_text:bar")
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
        where, having, _ = self.resolver.resolve_query("log.body:foo or log.severity_text:bar")
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
            "(log.body:123 and log.severity_text:345) or (log.body:foo and log.severity_text:bar)"
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
