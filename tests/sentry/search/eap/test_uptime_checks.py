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

from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.eap.uptime_checks.definitions import UPTIME_CHECK_DEFINITIONS
from sentry.search.events.types import SnubaParams
from sentry.testutils.cases import TestCase


class SearchResolverQueryTest(TestCase):
    def setUp(self):
        self.resolver = SearchResolver(
            params=SnubaParams(),
            config=SearchResolverConfig(),
            definitions=UPTIME_CHECK_DEFINITIONS,
        )

    def test_simple_query(self):
        where, having, _ = self.resolver.resolve_query("check_status:error")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="check_status", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="error"),
            )
        )
        assert having is None

    def test_negation(self):
        where, having, _ = self.resolver.resolve_query("!check_status:success")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="check_status", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_EQUALS,
                value=AttributeValue(val_str="success"),
            )
        )
        assert having is None

    def test_in_filter(self):
        where, having, _ = self.resolver.resolve_query("region:[us-east-1,us-west-1,eu-west-1]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="region", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(
                    val_str_array=StrArray(values=["us-east-1", "us-west-1", "eu-west-1"])
                ),
            )
        )
        assert having is None

    def test_numeric_comparison(self):
        where, having, _ = self.resolver.resolve_query("duration_ms:>1000")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="duration_ms", type=AttributeKey.Type.TYPE_DOUBLE),
                op=ComparisonFilter.OP_GREATER_THAN,
                value=AttributeValue(val_double=1000),
            )
        )
        assert having is None

    def test_http_status_code_filter(self):
        where, having, _ = self.resolver.resolve_query("http_status_code:[200,404,500]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="http_status_code", type=AttributeKey.Type.TYPE_DOUBLE),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_double_array=DoubleArray(values=[200, 404, 500])),
            )
        )
        assert having is None

    def test_query_with_and(self):
        where, having, _ = self.resolver.resolve_query("check_status:error region:us-east-1")
        assert where == TraceItemFilter(
            and_filter=AndFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="check_status", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="error"),
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(name="region", type=AttributeKey.Type.TYPE_STRING),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="us-east-1"),
                        )
                    ),
                ]
            )
        )
        assert having is None

    def test_query_with_or(self):
        where, having, _ = self.resolver.resolve_query("check_status:error or http_status_code:500")
        assert where == TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="check_status", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="error"),
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="http_status_code", type=AttributeKey.Type.TYPE_DOUBLE
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_double=500),
                        )
                    ),
                ]
            )
        )
        assert having is None

    def test_empty_query(self):
        where, having, _ = self.resolver.resolve_query("")
        assert where is None
        assert having is None

    def test_none_query(self):
        where, having, _ = self.resolver.resolve_query(None)
        assert where is None
        assert having is None
