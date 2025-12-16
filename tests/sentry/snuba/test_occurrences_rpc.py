from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    ExtrapolationMode,
    Function,
    IntArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.search.eap.occurrences.definitions import OCCURRENCE_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.testutils.cases import TestCase


class OccurrencesRPCTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(name="test")
        self.resolver = SearchResolver(
            params=SnubaParams(projects=[self.project]),
            config=SearchResolverConfig(),
            definitions=OCCURRENCE_DEFINITIONS,
        )

    def test_simple_query(self) -> None:
        where, having, _ = self.resolver.resolve_query("group_id:123")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="group_id", type=AttributeKey.Type.TYPE_INT),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_int=123),
            )
        )
        assert having is None

    def test_negation(self) -> None:
        where, having, _ = self.resolver.resolve_query("!group_id:123")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="group_id", type=AttributeKey.Type.TYPE_INT),
                op=ComparisonFilter.OP_NOT_EQUALS,
                value=AttributeValue(val_int=123),
            )
        )
        assert having is None

    def test_in_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query("group_id:[123, 456]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="group_id", type=AttributeKey.Type.TYPE_INT),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_int_array=IntArray(values=[123, 456])),
            )
        )
        assert having is None

    def test_group_id_field(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("group_id")
        assert resolved_column.proto_definition == AttributeKey(
            name="group_id", type=AttributeKey.Type.TYPE_INT
        )
        assert virtual_context is None

    def test_count_aggregate(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("count()")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_COUNT,
            key=AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT),
            label="count()",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None
        assert resolved_column.public_alias == "count()"
        assert resolved_column.search_type == "integer"
