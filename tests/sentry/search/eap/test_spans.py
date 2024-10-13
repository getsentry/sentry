import pytest
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    Function,
    IntArray,
    StrArray,
    VirtualColumnContext,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    OrFilter,
    TraceItemFilter,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.spans import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.testutils.cases import TestCase


class SearchResolverQueryTest(TestCase):
    def setUp(self):
        self.resolver = SearchResolver(params=SnubaParams(), config=SearchResolverConfig())

    def test_simple_query(self):
        query = self.resolver.resolve_query("span.description:foo")
        assert query == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="name", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="foo"),
            )
        )

    def test_negation(self):
        query = self.resolver.resolve_query("!span.description:foo")
        assert query == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="name", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_EQUALS,
                value=AttributeValue(val_str="foo"),
            )
        )

    def test_numeric_query(self):
        query = self.resolver.resolve_query("ai.total_tokens.used:123")
        assert query == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(
                    name="attr_num[ai_total_tokens_used]", type=AttributeKey.Type.TYPE_INT
                ),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_int=123),
            )
        )

    def test_in_filter(self):
        query = self.resolver.resolve_query("span.description:[foo,bar,baz]")
        assert query == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="name", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_str_array=StrArray(values=["foo", "bar", "baz"])),
            )
        )

    def test_uuid_validation(self):
        query = self.resolver.resolve_query(f"id:{'f'*16}")
        assert query == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="span_id", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="f" * 16),
            )
        )

    def test_invalid_uuid_validation(self):
        with pytest.raises(InvalidSearchQuery):
            self.resolver.resolve_query("id:hello")

    def test_not_in_filter(self):
        query = self.resolver.resolve_query("!span.description:[foo,bar,baz]")
        assert query == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="name", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_IN,
                value=AttributeValue(val_str_array=StrArray(values=["foo", "bar", "baz"])),
            )
        )

    def test_in_numeric_filter(self):
        query = self.resolver.resolve_query("ai.total_tokens.used:[123,456,789]")
        assert query == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(
                    name="attr_num[ai_total_tokens_used]", type=AttributeKey.Type.TYPE_INT
                ),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_int_array=IntArray(values=[123, 456, 789])),
            )
        )

    def test_greater_than_numeric_filter(self):
        query = self.resolver.resolve_query("ai.total_tokens.used:>123")
        assert query == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(
                    name="attr_num[ai_total_tokens_used]", type=AttributeKey.Type.TYPE_INT
                ),
                op=ComparisonFilter.OP_GREATER_THAN,
                value=AttributeValue(val_int=123),
            )
        )

    def test_query_with_and(self):
        query = self.resolver.resolve_query("span.description:foo span.op:bar")
        assert query == TraceItemFilter(
            and_filter=AndFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(name="name", type=AttributeKey.Type.TYPE_STRING),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="foo"),
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="attr_str[op]", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="bar"),
                        )
                    ),
                ]
            )
        )

    def test_query_with_or(self):
        query = self.resolver.resolve_query("span.description:foo or span.op:bar")
        assert query == TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(name="name", type=AttributeKey.Type.TYPE_STRING),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="foo"),
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="attr_str[op]", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="bar"),
                        )
                    ),
                ]
            )
        )

    def test_query_with_or_and_brackets(self):
        query = self.resolver.resolve_query(
            "(span.description:123 and span.op:345) or (span.description:foo and span.op:bar)"
        )
        assert query == TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        and_filter=AndFilter(
                            filters=[
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=AttributeKey(
                                            name="name", type=AttributeKey.Type.TYPE_STRING
                                        ),
                                        op=ComparisonFilter.OP_EQUALS,
                                        value=AttributeValue(val_str="123"),
                                    )
                                ),
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=AttributeKey(
                                            name="attr_str[op]", type=AttributeKey.Type.TYPE_STRING
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
                                            name="name", type=AttributeKey.Type.TYPE_STRING
                                        ),
                                        op=ComparisonFilter.OP_EQUALS,
                                        value=AttributeValue(val_str="foo"),
                                    )
                                ),
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=AttributeKey(
                                            name="attr_str[op]", type=AttributeKey.Type.TYPE_STRING
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
        query = self.resolver.resolve_query("")
        assert query is None


class SearchResolverColumnTest(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project(name="test")
        self.resolver = SearchResolver(
            params=SnubaParams(projects=[self.project]), config=SearchResolverConfig()
        )

    def test_simple_op_field(self):
        resolved_column, virtual_context = self.resolver.resolve_column("span.op")
        assert resolved_column.proto_definition == AttributeKey(
            name="attr_str[op]", type=AttributeKey.Type.TYPE_STRING
        )
        assert virtual_context is None

    def test_project_field(self):
        resolved_column, virtual_context = self.resolver.resolve_column("project")
        assert resolved_column.proto_definition == AttributeKey(
            name="project_id", type=AttributeKey.Type.TYPE_INT
        )
        assert virtual_context == VirtualColumnContext(
            from_column_name="project_id",
            to_column_name="project",
            value_map={str(self.project.id): self.project.slug},
        )

    def test_project_slug_field(self):
        resolved_column, virtual_context = self.resolver.resolve_column("project.slug")
        assert resolved_column.proto_definition == AttributeKey(
            name="project_id", type=AttributeKey.Type.TYPE_INT
        )
        assert virtual_context == VirtualColumnContext(
            from_column_name="project_id",
            to_column_name="project.slug",
            value_map={str(self.project.id): self.project.slug},
        )

    def test_simple_tag(self):
        resolved_column, virtual_context = self.resolver.resolve_column("tags[foo]")
        assert resolved_column.proto_definition == AttributeKey(
            name="attr_str[foo]", type=AttributeKey.Type.TYPE_STRING
        )
        assert virtual_context is None

    def test_simple_string_tag(self):
        resolved_column, virtual_context = self.resolver.resolve_column("tags[foo, string]")
        assert resolved_column.proto_definition == AttributeKey(
            name="attr_str[foo]", type=AttributeKey.Type.TYPE_STRING
        )
        assert virtual_context is None

    def test_simple_number_tag(self):
        resolved_column, virtual_context = self.resolver.resolve_column("tags[foo, number]")
        assert resolved_column.proto_definition == AttributeKey(
            name="attr_num[foo]", type=AttributeKey.Type.TYPE_INT
        )
        assert virtual_context is None

    def test_sum_function(self):
        resolved_column, virtual_context = self.resolver.resolve_column("sum(span.self_time)")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_SUM,
            key=AttributeKey(name="exclusive_time_ms", type=AttributeKey.Type.TYPE_INT),
            label="sum(span.self_time)",
        )
        assert virtual_context is None

    def test_sum_default_argument(self):
        resolved_column, virtual_context = self.resolver.resolve_column("sum()")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_SUM,
            key=AttributeKey(name="duration_ms", type=AttributeKey.Type.TYPE_INT),
            label="sum()",
        )
        assert virtual_context is None

    def test_function_alias(self):
        resolved_column, virtual_context = self.resolver.resolve_column("sum() as test")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_SUM,
            key=AttributeKey(name="duration_ms", type=AttributeKey.Type.TYPE_INT),
            label="test",
        )
        assert virtual_context is None

    def test_count(self):
        resolved_column, virtual_context = self.resolver.resolve_column("count()")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_COUNT, key=None, label="count()"
        )
        assert virtual_context is None
        resolved_column, virtual_context = self.resolver.resolve_column("count(span.duration)")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_COUNT, key=None, label="count(span.duration)"
        )
        assert virtual_context is None

    def test_p50(self):
        resolved_column, virtual_context = self.resolver.resolve_column("p50()")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_P50,
            key=AttributeKey(name="duration_ms", type=AttributeKey.Type.TYPE_INT),
            label="p50()",
        )
        assert virtual_context is None

    def test_count_unique(self):
        resolved_column, virtual_context = self.resolver.resolve_column("count_unique(span.action)")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_UNIQ,
            key=AttributeKey(name="action", type=AttributeKey.Type.TYPE_STRING),
            label="count_unique(span.action)",
        )
        assert virtual_context is None
