from unittest import TestCase

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    AttributeValue,
    StrArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    OrFilter,
    TraceItemFilter,
)

from sentry.search.eap.processing_errors.definitions import PROCESSING_ERROR_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams


class SearchResolverQueryTest(TestCase):
    def setUp(self) -> None:
        self.resolver = SearchResolver(
            params=SnubaParams(),
            config=SearchResolverConfig(),
            definitions=PROCESSING_ERROR_DEFINITIONS,
        )

    def test_simple_query(self) -> None:
        where, having, _ = self.resolver.resolve_query("error_type:js_no_source")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="error_type", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="js_no_source"),
            )
        )
        assert having is None

    def test_negation(self) -> None:
        where, having, _ = self.resolver.resolve_query("!error_type:js_no_source")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="error_type", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_EQUALS,
                value=AttributeValue(val_str="js_no_source"),
            )
        )
        assert having is None

    def test_in_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query(
            "error_type:[js_no_source,js_invalid_source,js_scraping_disabled]"
        )
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="error_type", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(
                    val_str_array=StrArray(
                        values=["js_no_source", "js_invalid_source", "js_scraping_disabled"]
                    )
                ),
            )
        )
        assert having is None

    def test_symbolicator_type_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query("symbolicator_type:missing_sourcemap")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="symbolicator_type", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="missing_sourcemap"),
            )
        )
        assert having is None

    def test_query_with_and(self) -> None:
        where, having, _ = self.resolver.resolve_query(
            "error_type:js_no_source platform:javascript"
        )
        assert where == TraceItemFilter(
            and_filter=AndFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(name="error_type", type=AttributeKey.Type.TYPE_STRING),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="js_no_source"),
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(name="platform", type=AttributeKey.Type.TYPE_STRING),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="javascript"),
                        )
                    ),
                ]
            )
        )
        assert having is None

    def test_query_with_or(self) -> None:
        where, having, _ = self.resolver.resolve_query(
            "error_type:js_no_source or error_type:js_invalid_source"
        )
        assert where == TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(name="error_type", type=AttributeKey.Type.TYPE_STRING),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="js_no_source"),
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(name="error_type", type=AttributeKey.Type.TYPE_STRING),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="js_invalid_source"),
                        )
                    ),
                ]
            )
        )
        assert having is None

    def test_empty_query(self) -> None:
        where, having, _ = self.resolver.resolve_query("")
        assert where is None
        assert having is None

    def test_none_query(self) -> None:
        where, having, _ = self.resolver.resolve_query(None)
        assert where is None
        assert having is None
