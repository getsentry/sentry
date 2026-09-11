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
    NotFilter,
    OrFilter,
    TraceItemFilter,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.constants import REGEX_OPERATOR
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

    def test_id_query_normalizes_dashes(self) -> None:
        """Dashed UUIDs in id: filters are normalized to dashless hex before sending to Snuba."""
        where, having, _ = self.resolver.resolve_query("id:f13343d4-6625-40d0-946f-f5b4d564c642")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.item_id", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="f13343d4662540d0946ff5b4d564c642"),
            )
        )
        assert having is None

    def test_id_query_dashless_unchanged(self) -> None:
        """Already-dashless hex IDs pass through normalization unchanged."""
        where, having, _ = self.resolver.resolve_query("id:f13343d4662540d0946ff5b4d564c642")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.item_id", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="f13343d4662540d0946ff5b4d564c642"),
            )
        )
        assert having is None

    def test_trace_query_normalizes_dashes(self) -> None:
        """Dashed UUIDs in trace: filters are normalized to dashless hex."""
        where, having, _ = self.resolver.resolve_query("trace:f13343d4-6625-40d0-946f-f5b4d564c642")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.trace_id", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="f13343d4662540d0946ff5b4d564c642"),
            )
        )
        assert having is None

    def test_id_in_filter_normalizes_dashes(self) -> None:
        """Dashed UUIDs in id:[...] IN filters are normalized."""
        where, having, _ = self.resolver.resolve_query(
            "id:[f13343d4-6625-40d0-946f-f5b4d564c642,b802415f-7531-431c-aa27-f5c0bf923302]"
        )
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.item_id", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(
                    val_str_array=StrArray(
                        values=[
                            "f13343d4662540d0946ff5b4d564c642",
                            "b802415f7531431caa27f5c0bf923302",
                        ]
                    )
                ),
            )
        )
        assert having is None

    def test_internal_name_resolves_with_normalizer(self) -> None:
        """Using the internal name 'sentry.item_id' resolves to the same definition as 'id'
        with the correct validator and normalizer, so dashed UUIDs are normalized."""
        where, having, _ = self.resolver.resolve_query(
            "sentry.item_id:f13343d4-6625-40d0-946f-f5b4d564c642"
        )
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.item_id", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="f13343d4662540d0946ff5b4d564c642"),
            )
        )
        assert having is None

    def test_regex_query(self) -> None:
        where, having, _ = self.resolver.resolve_query(f"message:{REGEX_OPERATOR}^ERROR")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_REGEXP,
                value=AttributeValue(val_str="^ERROR"),
            )
        )
        assert having is None

    def test_regex_query_negated(self) -> None:
        where, having, _ = self.resolver.resolve_query(f"!message:{REGEX_OPERATOR}^ERROR")
        assert where == TraceItemFilter(
            not_filter=NotFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="sentry.body", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_REGEXP,
                            value=AttributeValue(val_str="^ERROR"),
                        )
                    )
                ]
            )
        )
        assert having is None

    def test_regex_query_on_an_attribute(self) -> None:
        where, having, _ = self.resolver.resolve_query(f"foo:{REGEX_OPERATOR}ba[rz]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="foo", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_REGEXP,
                value=AttributeValue(val_str="ba[rz]"),
            )
        )
        assert having is None

    def test_regex_query_keeps_the_pattern_verbatim(self) -> None:
        """Regex metacharacters must not be rewritten the way wildcard patterns are."""
        where, _, _ = self.resolver.resolve_query(f"message:{REGEX_OPERATOR}a*b%c_d\\*e")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_REGEXP,
                value=AttributeValue(val_str="a*b%c_d\\*e"),
            )
        )

    def test_regex_query_is_case_insensitive_when_requested(self) -> None:
        resolver = SearchResolver(
            params=SnubaParams(case_insensitive=True),
            config=SearchResolverConfig(),
            definitions=OURLOG_DEFINITIONS,
        )
        where, _, _ = resolver.resolve_query(f"message:{REGEX_OPERATOR}^[A-Z]rror")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_REGEXP,
                value=AttributeValue(val_str="(?i)^[A-Z]rror"),
            )
        )

    def test_regex_in_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query(f"message:{REGEX_OPERATOR}[^ERROR, ^WARN]")
        assert where == TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="sentry.body", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_REGEXP,
                            value=AttributeValue(val_str="^ERROR"),
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="sentry.body", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_REGEXP,
                            value=AttributeValue(val_str="^WARN"),
                        )
                    ),
                ]
            )
        )
        assert having is None

    def test_regex_not_in_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query(f"!message:{REGEX_OPERATOR}[^ERROR, ^WARN]")
        assert where == TraceItemFilter(
            not_filter=NotFilter(
                filters=[
                    TraceItemFilter(
                        or_filter=OrFilter(
                            filters=[
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=AttributeKey(
                                            name="sentry.body",
                                            type=AttributeKey.Type.TYPE_STRING,
                                        ),
                                        op=ComparisonFilter.OP_REGEXP,
                                        value=AttributeValue(val_str="^ERROR"),
                                    )
                                ),
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=AttributeKey(
                                            name="sentry.body",
                                            type=AttributeKey.Type.TYPE_STRING,
                                        ),
                                        op=ComparisonFilter.OP_REGEXP,
                                        value=AttributeValue(val_str="^WARN"),
                                    )
                                ),
                            ]
                        )
                    )
                ]
            )
        )
        assert having is None

    def test_regex_query_raises_when_the_key_is_backed_by_a_filter_alias(self) -> None:
        with pytest.raises(InvalidSearchQuery) as err:
            self.resolver.resolve_query(f"release:{REGEX_OPERATOR}^1\\.2")
        assert str(err.value) == "Cannot use regular expressions with release"

    def test_regex_query_raises_when_the_key_is_backed_by_a_virtual_column(self) -> None:
        with pytest.raises(InvalidSearchQuery) as err:
            self.resolver.resolve_query(f"project:{REGEX_OPERATOR}^sen")
        assert str(err.value) == "Cannot use regular expressions with project"

    def test_regex_query_raises_on_a_virtual_column_in_a_timeseries_request(self) -> None:
        resolver = SearchResolver(
            params=SnubaParams(granularity_secs=60),
            config=SearchResolverConfig(),
            definitions=OURLOG_DEFINITIONS,
        )
        with pytest.raises(InvalidSearchQuery) as err:
            resolver.resolve_query(f"project:{REGEX_OPERATOR}^sen")
        assert str(err.value) == "Cannot use regular expressions with project"

    def test_regex_query_raises_when_the_attribute_is_not_a_string(self) -> None:
        with pytest.raises(InvalidSearchQuery) as err:
            self.resolver.resolve_query(f"tags[foo,boolean]:{REGEX_OPERATOR}tru.")
        assert "not a string attribute" in str(err.value)

    def test_internal_trace_id_resolves_with_normalizer(self) -> None:
        """Using the internal name 'sentry.trace_id' resolves with normalizer."""
        where, having, _ = self.resolver.resolve_query(
            "sentry.trace_id:f13343d4-6625-40d0-946f-f5b4d564c642"
        )
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.trace_id", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="f13343d4662540d0946ff5b4d564c642"),
            )
        )
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
