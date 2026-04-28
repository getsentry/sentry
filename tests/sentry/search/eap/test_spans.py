import os
from datetime import datetime

import pytest
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    AggregationAndFilter,
    AggregationComparisonFilter,
    AggregationFilter,
    AggregationOrFilter,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    ExtrapolationMode,
    Function,
    IntArray,
    StrArray,
    VirtualColumnContext,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    ExistsFilter,
    NotFilter,
    OrFilter,
    TraceItemFilter,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import ResolvedAttribute
from sentry.search.eap.occurrences.definitions import OCCURRENCE_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.attributes import (
    SPAN_ATTRIBUTE_DEFINITIONS,
    SPANS_REPLACEMENT_MAP,
    _update_attribute_definitions_with_deprecations,
)
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.spans.sentry_conventions import SENTRY_CONVENTIONS_DIRECTORY
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import json


class SearchResolverQueryTest(TestCase):
    def setUp(self) -> None:
        self.resolver = SearchResolver(
            params=SnubaParams(), config=SearchResolverConfig(), definitions=SPAN_DEFINITIONS
        )

    def test_simple_query(self) -> None:
        where, having, _ = self.resolver.resolve_query("span.description:foo")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.raw_description", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="foo"),
            )
        )
        assert having is None

    def test_negation(self) -> None:
        where, having, _ = self.resolver.resolve_query("!span.description:foo")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.raw_description", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_EQUALS,
                value=AttributeValue(val_str="foo"),
            )
        )
        assert having is None

    def test_numeric_query(self) -> None:
        where, having, _ = self.resolver.resolve_query("ai.total_tokens.used:123")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="ai_total_tokens_used", type=AttributeKey.Type.TYPE_INT),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_int=123),
            )
        )
        assert having is None

    def test_in_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query("span.description:[foo,bar,baz]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.raw_description", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_str_array=StrArray(values=["foo", "bar", "baz"])),
            )
        )
        assert having is None

    def test_uuid_validation(self) -> None:
        where, having, _ = self.resolver.resolve_query(f"id:{'f' * 16}")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.item_id", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="f" * 16),
            )
        )
        assert having is None

    def test_invalid_uuid_validation(self) -> None:
        with pytest.raises(InvalidSearchQuery):
            self.resolver.resolve_query("id:hello")

    def test_not_in_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query("!span.description:[foo,bar,baz]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.raw_description", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_IN,
                value=AttributeValue(val_str_array=StrArray(values=["foo", "bar", "baz"])),
            )
        )
        assert having is None

    def test_in_numeric_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query("ai.total_tokens.used:[123,456,789]")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="ai_total_tokens_used", type=AttributeKey.Type.TYPE_INT),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_int_array=IntArray(values=[123, 456, 789])),
            )
        )
        assert having is None

    def test_greater_than_numeric_filter(self) -> None:
        where, having, _ = self.resolver.resolve_query("ai.total_tokens.used:>123")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="ai_total_tokens_used", type=AttributeKey.Type.TYPE_INT),
                op=ComparisonFilter.OP_GREATER_THAN,
                value=AttributeValue(val_int=123),
            )
        )
        assert having is None

    def test_timestamp_relative_filter(self) -> None:
        with freeze_time("2018-12-11 10:20:00"):
            where, having, _ = self.resolver.resolve_query("timestamp:-24h")
            assert where == TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(name="sentry.timestamp", type=AttributeKey.Type.TYPE_DOUBLE),
                    op=ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
                    value=AttributeValue(
                        val_double=datetime.fromisoformat("2018-12-10 10:20:00+00:00").timestamp()
                    ),
                )
            )
            assert having is None

    def test_query_with_and(self) -> None:
        where, having, _ = self.resolver.resolve_query("span.description:foo span.op:bar")
        assert where == TraceItemFilter(
            and_filter=AndFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="sentry.raw_description", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="foo"),
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(name="sentry.op", type=AttributeKey.Type.TYPE_STRING),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="bar"),
                        )
                    ),
                ]
            )
        )
        assert having is None

    def test_query_with_or(self) -> None:
        where, having, _ = self.resolver.resolve_query("span.description:foo or span.op:bar")
        assert where == TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="sentry.raw_description", type=AttributeKey.Type.TYPE_STRING
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="foo"),
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(name="sentry.op", type=AttributeKey.Type.TYPE_STRING),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="bar"),
                        )
                    ),
                ]
            )
        )
        assert having is None

    def test_has_in_filter_multi_key(self) -> None:
        """Multi-key has:[key1,key2] (event_search has_in_filter) resolves to OR of (exists + != '')."""
        where, having, _ = self.resolver.resolve_query("has:[span.description,span.op]")
        desc_key = AttributeKey(name="sentry.raw_description", type=AttributeKey.Type.TYPE_STRING)
        op_key = AttributeKey(name="sentry.op", type=AttributeKey.Type.TYPE_STRING)
        assert where == TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        and_filter=AndFilter(
                            filters=[
                                TraceItemFilter(
                                    exists_filter=ExistsFilter(key=desc_key),
                                ),
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=desc_key,
                                        op=ComparisonFilter.OP_NOT_EQUALS,
                                        value=AttributeValue(val_str=""),
                                    )
                                ),
                            ]
                        )
                    ),
                    TraceItemFilter(
                        and_filter=AndFilter(
                            filters=[
                                TraceItemFilter(
                                    exists_filter=ExistsFilter(key=op_key),
                                ),
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=op_key,
                                        op=ComparisonFilter.OP_NOT_EQUALS,
                                        value=AttributeValue(val_str=""),
                                    )
                                ),
                            ]
                        )
                    ),
                ]
            )
        )
        assert having is None

    def test_not_has_in_filter_multi_key(self) -> None:
        """Negated multi-key !has:[key1,key2] resolves to AND of (not-exists OR = '')."""
        where, having, _ = self.resolver.resolve_query("!has:[span.description,span.op]")
        desc_key = AttributeKey(name="sentry.raw_description", type=AttributeKey.Type.TYPE_STRING)
        op_key = AttributeKey(name="sentry.op", type=AttributeKey.Type.TYPE_STRING)
        assert where == TraceItemFilter(
            and_filter=AndFilter(
                filters=[
                    TraceItemFilter(
                        or_filter=OrFilter(
                            filters=[
                                TraceItemFilter(
                                    not_filter=NotFilter(
                                        filters=[
                                            TraceItemFilter(
                                                exists_filter=ExistsFilter(key=desc_key),
                                            )
                                        ]
                                    )
                                ),
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=desc_key,
                                        op=ComparisonFilter.OP_EQUALS,
                                        value=AttributeValue(val_str=""),
                                    )
                                ),
                            ]
                        )
                    ),
                    TraceItemFilter(
                        or_filter=OrFilter(
                            filters=[
                                TraceItemFilter(
                                    not_filter=NotFilter(
                                        filters=[
                                            TraceItemFilter(
                                                exists_filter=ExistsFilter(key=op_key),
                                            )
                                        ]
                                    )
                                ),
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=op_key,
                                        op=ComparisonFilter.OP_EQUALS,
                                        value=AttributeValue(val_str=""),
                                    )
                                ),
                            ]
                        )
                    ),
                ]
            )
        )
        assert having is None

    def test_query_with_or_and_brackets(self) -> None:
        where, having, _ = self.resolver.resolve_query(
            "(span.description:123 and span.op:345) or (span.description:foo and span.op:bar)"
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
                                            name="sentry.raw_description",
                                            type=AttributeKey.Type.TYPE_STRING,
                                        ),
                                        op=ComparisonFilter.OP_EQUALS,
                                        value=AttributeValue(val_str="123"),
                                    )
                                ),
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=AttributeKey(
                                            name="sentry.op", type=AttributeKey.Type.TYPE_STRING
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
                                            name="sentry.raw_description",
                                            type=AttributeKey.Type.TYPE_STRING,
                                        ),
                                        op=ComparisonFilter.OP_EQUALS,
                                        value=AttributeValue(val_str="foo"),
                                    )
                                ),
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=AttributeKey(
                                            name="sentry.op", type=AttributeKey.Type.TYPE_STRING
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

    def test_simple_aggregate_query(self) -> None:
        operators = [
            ("", AggregationComparisonFilter.OP_EQUALS),
            (">", AggregationComparisonFilter.OP_GREATER_THAN),
            (">=", AggregationComparisonFilter.OP_GREATER_THAN_OR_EQUALS),
            ("<", AggregationComparisonFilter.OP_LESS_THAN),
            ("<=", AggregationComparisonFilter.OP_LESS_THAN_OR_EQUALS),
        ]
        for str_op, rpc_op in operators:
            where, having, _ = self.resolver.resolve_query(f"count():{str_op}2")
            assert where is None
            assert having == AggregationFilter(
                comparison_filter=AggregationComparisonFilter(
                    aggregation=AttributeAggregation(
                        aggregate=Function.FUNCTION_COUNT,
                        key=AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT),
                        label="count()",
                        extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                    ),
                    op=rpc_op,
                    val=2,
                )
            )

    def test_simple_negation_aggregate_query(self) -> None:
        operators = [
            ("", AggregationComparisonFilter.OP_NOT_EQUALS),
            (">", AggregationComparisonFilter.OP_LESS_THAN_OR_EQUALS),
            (">=", AggregationComparisonFilter.OP_LESS_THAN),
            ("<", AggregationComparisonFilter.OP_GREATER_THAN_OR_EQUALS),
            ("<=", AggregationComparisonFilter.OP_GREATER_THAN),
        ]
        for str_op, rpc_op in operators:
            where, having, _ = self.resolver.resolve_query(f"!count():{str_op}2")
            assert where is None
            assert having == AggregationFilter(
                comparison_filter=AggregationComparisonFilter(
                    aggregation=AttributeAggregation(
                        aggregate=Function.FUNCTION_COUNT,
                        key=AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT),
                        label="count()",
                        extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                    ),
                    op=rpc_op,
                    val=2,
                )
            )

    def test_aggregate_query_on_custom_attributes(self) -> None:
        where, having, _ = self.resolver.resolve_query("avg(tags[foo,number]):>1000")
        assert where is None
        assert having == AggregationFilter(
            comparison_filter=AggregationComparisonFilter(
                aggregation=AttributeAggregation(
                    aggregate=Function.FUNCTION_AVG,
                    key=AttributeKey(name="foo", type=AttributeKey.Type.TYPE_DOUBLE),
                    label="avg(tags[foo,number])",
                    extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                ),
                op=AggregationComparisonFilter.OP_GREATER_THAN,
                val=1000,
            )
        )

    def test_aggregate_query_on_attributes_with_units(self) -> None:
        for value in ["1000", "1s", "1000ms"]:
            where, having, _ = self.resolver.resolve_query(f"avg(measurements.lcp):>{value}")
            assert where is None
            assert having == AggregationFilter(
                comparison_filter=AggregationComparisonFilter(
                    aggregation=AttributeAggregation(
                        aggregate=Function.FUNCTION_AVG,
                        key=AttributeKey(name="lcp", type=AttributeKey.Type.TYPE_DOUBLE),
                        label="avg(measurements.lcp)",
                        extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                    ),
                    op=AggregationComparisonFilter.OP_GREATER_THAN,
                    val=1000,
                )
            )

    def test_aggregate_query_with_multiple_conditions(self) -> None:
        where, having, _ = self.resolver.resolve_query("count():>1 avg(measurements.lcp):>3000")
        assert where is None
        assert having == AggregationFilter(
            and_filter=AggregationAndFilter(
                filters=[
                    AggregationFilter(
                        comparison_filter=AggregationComparisonFilter(
                            aggregation=AttributeAggregation(
                                aggregate=Function.FUNCTION_COUNT,
                                key=AttributeKey(
                                    name="sentry.project_id", type=AttributeKey.Type.TYPE_INT
                                ),
                                label="count()",
                                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                            ),
                            op=AggregationComparisonFilter.OP_GREATER_THAN,
                            val=1,
                        ),
                    ),
                    AggregationFilter(
                        comparison_filter=AggregationComparisonFilter(
                            aggregation=AttributeAggregation(
                                aggregate=Function.FUNCTION_AVG,
                                key=AttributeKey(name="lcp", type=AttributeKey.Type.TYPE_DOUBLE),
                                label="avg(measurements.lcp)",
                                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                            ),
                            op=AggregationComparisonFilter.OP_GREATER_THAN,
                            val=3000,
                        ),
                    ),
                ],
            )
        )

    def test_aggregate_query_with_multiple_conditions_explicit_and(self) -> None:
        where, having, _ = self.resolver.resolve_query("count():>1 AND avg(measurements.lcp):>3000")
        assert where is None
        assert having == AggregationFilter(
            and_filter=AggregationAndFilter(
                filters=[
                    AggregationFilter(
                        comparison_filter=AggregationComparisonFilter(
                            aggregation=AttributeAggregation(
                                aggregate=Function.FUNCTION_COUNT,
                                key=AttributeKey(
                                    name="sentry.project_id", type=AttributeKey.Type.TYPE_INT
                                ),
                                label="count()",
                                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                            ),
                            op=AggregationComparisonFilter.OP_GREATER_THAN,
                            val=1,
                        ),
                    ),
                    AggregationFilter(
                        comparison_filter=AggregationComparisonFilter(
                            aggregation=AttributeAggregation(
                                aggregate=Function.FUNCTION_AVG,
                                key=AttributeKey(name="lcp", type=AttributeKey.Type.TYPE_DOUBLE),
                                label="avg(measurements.lcp)",
                                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                            ),
                            op=AggregationComparisonFilter.OP_GREATER_THAN,
                            val=3000,
                        ),
                    ),
                ],
            )
        )

    def test_aggregate_query_with_multiple_conditions_explicit_or(self) -> None:
        where, having, _ = self.resolver.resolve_query("count():>1 or avg(measurements.lcp):>3000")
        assert where is None
        assert having == AggregationFilter(
            or_filter=AggregationOrFilter(
                filters=[
                    AggregationFilter(
                        comparison_filter=AggregationComparisonFilter(
                            aggregation=AttributeAggregation(
                                aggregate=Function.FUNCTION_COUNT,
                                key=AttributeKey(
                                    name="sentry.project_id", type=AttributeKey.Type.TYPE_INT
                                ),
                                label="count()",
                                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                            ),
                            op=AggregationComparisonFilter.OP_GREATER_THAN,
                            val=1,
                        ),
                    ),
                    AggregationFilter(
                        comparison_filter=AggregationComparisonFilter(
                            aggregation=AttributeAggregation(
                                aggregate=Function.FUNCTION_AVG,
                                key=AttributeKey(name="lcp", type=AttributeKey.Type.TYPE_DOUBLE),
                                label="avg(measurements.lcp)",
                                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                            ),
                            op=AggregationComparisonFilter.OP_GREATER_THAN,
                            val=3000,
                        ),
                    ),
                ],
            )
        )

    def test_aggregate_query_with_multiple_conditions_nested(self) -> None:
        where, having, _ = self.resolver.resolve_query(
            "(count():>1 AND avg(http.response_content_length):>3000) OR (count():>1 AND avg(measurements.lcp):>3000)"
        )
        assert where is None
        assert having == AggregationFilter(
            or_filter=AggregationOrFilter(
                filters=[
                    AggregationFilter(
                        and_filter=AggregationAndFilter(
                            filters=[
                                AggregationFilter(
                                    comparison_filter=AggregationComparisonFilter(
                                        aggregation=AttributeAggregation(
                                            aggregate=Function.FUNCTION_COUNT,
                                            key=AttributeKey(
                                                name="sentry.project_id",
                                                type=AttributeKey.Type.TYPE_INT,
                                            ),
                                            label="count()",
                                            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                                        ),
                                        op=AggregationComparisonFilter.OP_GREATER_THAN,
                                        val=1,
                                    ),
                                ),
                                AggregationFilter(
                                    comparison_filter=AggregationComparisonFilter(
                                        aggregation=AttributeAggregation(
                                            aggregate=Function.FUNCTION_AVG,
                                            key=AttributeKey(
                                                name="http.response_content_length",
                                                type=AttributeKey.Type.TYPE_DOUBLE,
                                            ),
                                            label="avg(http.response_content_length)",
                                            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                                        ),
                                        op=AggregationComparisonFilter.OP_GREATER_THAN,
                                        val=3000,
                                    ),
                                ),
                            ],
                        )
                    ),
                    AggregationFilter(
                        and_filter=AggregationAndFilter(
                            filters=[
                                AggregationFilter(
                                    comparison_filter=AggregationComparisonFilter(
                                        aggregation=AttributeAggregation(
                                            aggregate=Function.FUNCTION_COUNT,
                                            key=AttributeKey(
                                                name="sentry.project_id",
                                                type=AttributeKey.Type.TYPE_INT,
                                            ),
                                            label="count()",
                                            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                                        ),
                                        op=AggregationComparisonFilter.OP_GREATER_THAN,
                                        val=1,
                                    ),
                                ),
                                AggregationFilter(
                                    comparison_filter=AggregationComparisonFilter(
                                        aggregation=AttributeAggregation(
                                            aggregate=Function.FUNCTION_AVG,
                                            key=AttributeKey(
                                                name="lcp", type=AttributeKey.Type.TYPE_DOUBLE
                                            ),
                                            label="avg(measurements.lcp)",
                                            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
                                        ),
                                        op=AggregationComparisonFilter.OP_GREATER_THAN,
                                        val=3000,
                                    ),
                                ),
                            ],
                        )
                    ),
                ]
            )
        )

    def test_cache_update_for_issues(self) -> None:
        resolver = SearchResolver(
            params=SnubaParams(organization=self.organization, projects=[self.project]),
            config=SearchResolverConfig(),
            definitions=OCCURRENCE_DEFINITIONS,
        )
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        resolver.resolve_query(f"issue:{group1.qualified_short_id}")
        project_id = group1.project_id
        assert project_id in resolver.qualified_short_id_to_group_id_cache
        assert len(resolver.qualified_short_id_to_group_id_cache[project_id]) == 1
        assert (
            group1.qualified_short_id in resolver.qualified_short_id_to_group_id_cache[project_id]
        )

        resolver.resolve_query(f"issue:{group2.qualified_short_id}")
        assert len(resolver.qualified_short_id_to_group_id_cache[project_id]) == 2
        assert (
            group2.qualified_short_id in resolver.qualified_short_id_to_group_id_cache[project_id]
        )


class SearchResolverColumnTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project(name="test")
        self.resolver = SearchResolver(
            params=SnubaParams(projects=[self.project]),
            config=SearchResolverConfig(),
            definitions=SPAN_DEFINITIONS,
        )

    def test_simple_op_field(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("span.op")
        assert resolved_column.proto_definition == AttributeKey(
            name="sentry.op", type=AttributeKey.Type.TYPE_STRING
        )
        assert virtual_context is None

    def test_project_field(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("project")
        assert resolved_column.proto_definition == AttributeKey(
            name="project", type=AttributeKey.Type.TYPE_STRING
        )
        assert virtual_context is not None
        assert virtual_context.constructor(
            self.resolver.params, self.resolver
        ) == VirtualColumnContext(
            from_column_name="sentry.project_id",
            to_column_name="project",
            value_map={str(self.project.id): self.project.slug},
        )

    def test_project_slug_field(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("project.slug")
        assert resolved_column.proto_definition == AttributeKey(
            name="project.slug", type=AttributeKey.Type.TYPE_STRING
        )
        assert virtual_context is not None
        assert virtual_context.constructor(
            self.resolver.params, self.resolver
        ) == VirtualColumnContext(
            from_column_name="sentry.project_id",
            to_column_name="project.slug",
            value_map={str(self.project.id): self.project.slug},
        )

    def test_simple_tag(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("tags[foo]")
        assert resolved_column.proto_definition == AttributeKey(
            name="foo", type=AttributeKey.Type.TYPE_STRING
        )
        assert virtual_context is None

    def test_simple_string_tag(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("tags[foo, string]")
        assert resolved_column.proto_definition == AttributeKey(
            name="foo", type=AttributeKey.Type.TYPE_STRING
        )
        assert virtual_context is None

    def test_simple_number_tag(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("tags[foo, number]")
        assert resolved_column.proto_definition == AttributeKey(
            name="foo", type=AttributeKey.Type.TYPE_DOUBLE
        )
        assert virtual_context is None

    def test_sum_function(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("sum(span.self_time)")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_SUM,
            key=AttributeKey(name="sentry.exclusive_time_ms", type=AttributeKey.Type.TYPE_DOUBLE),
            label="sum(span.self_time)",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None

    def test_sum_default_argument(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("sum()")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_SUM,
            key=AttributeKey(name="sentry.duration_ms", type=AttributeKey.Type.TYPE_DOUBLE),
            label="sum()",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None

    def test_function_alias(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("sum() as test")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_SUM,
            key=AttributeKey(name="sentry.duration_ms", type=AttributeKey.Type.TYPE_DOUBLE),
            label="test",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None

    def test_count(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("count()")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_COUNT,
            key=AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT),
            label="count()",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None
        resolved_column, virtual_context = self.resolver.resolve_column("count(span.duration)")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_COUNT,
            key=AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT),
            label="count(span.duration)",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None

    def test_p50(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("p50()")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_P50,
            key=AttributeKey(name="sentry.duration_ms", type=AttributeKey.Type.TYPE_DOUBLE),
            label="p50()",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None

    def test_count_unique(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("count_unique(span.action)")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_UNIQ,
            key=AttributeKey(name="sentry.action", type=AttributeKey.Type.TYPE_STRING),
            label="count_unique(span.action)",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None

    def test_resolver_cache_attribute(self) -> None:
        self.resolver.resolve_columns(["span.op"])
        assert "span.op" in self.resolver._resolved_attribute_cache

        project_column, project_context = self.resolver.resolve_column("project")
        # Override the cache so we can confirm its being used
        self.resolver._resolved_attribute_cache["span.op"] = project_column, project_context  # type: ignore[assignment]

        # If we resolve op again, we should get the project context and column instead
        resolved_column, virtual_context = self.resolver.resolve_column("span.op")
        assert (resolved_column, virtual_context) == (project_column, project_context)

    def test_resolver_cache_function(self) -> None:
        self.resolver.resolve_columns(["count()"])
        assert "count()" in self.resolver._resolved_function_cache

        p95_column, p95_context = self.resolver.resolve_column("p95(span.duration) as foo")
        self.resolver._resolved_function_cache["count()"] = p95_column, p95_context  # type: ignore[assignment]

        resolved_column, virtual_context = self.resolver.resolve_column("count()")
        assert (resolved_column, virtual_context) == (p95_column, p95_context)


def test_loads_deprecated_attrs_json() -> None:
    with open(os.path.join(SENTRY_CONVENTIONS_DIRECTORY, "deprecated_attributes.json"), "rb") as f:
        deprecated_attrs = json.loads(f.read())["attributes"]

    attribute = deprecated_attrs[0]
    assert attribute["key"]
    assert attribute["deprecation"]


def test_backfilled_deprecated_attributes_resolve_to_replacement() -> None:
    deprecated_attr = SPAN_ATTRIBUTE_DEFINITIONS["http.response_content_length"]
    replacement_attr = SPAN_ATTRIBUTE_DEFINITIONS["http.response.body.size"]

    assert deprecated_attr.internal_name == "http.response_content_length"
    assert deprecated_attr.search_type == "byte"
    assert deprecated_attr.deprecation_status == "backfill"
    assert deprecated_attr.replacement == "http.response.body.size"
    assert replacement_attr.internal_name == "http.response.body.size"
    assert replacement_attr.search_type == "byte"
    assert SPANS_REPLACEMENT_MAP["http.response_content_length"] == "http.response.body.size"


def test_deprecated_attribute_internal_alias_preserves_existing_search_type() -> None:
    attribute_definitions = {
        "mobile.total_frames": SPAN_ATTRIBUTE_DEFINITIONS["mobile.total_frames"],
    }
    mobile_total_frames_attr = attribute_definitions["mobile.total_frames"]

    assert mobile_total_frames_attr.public_alias == "mobile.total_frames"
    assert mobile_total_frames_attr.internal_name == "frames.total"

    _update_attribute_definitions_with_deprecations(
        attribute_definitions,
        [
            {
                "key": "frames.total",
                "type": "integer",
                "deprecation": {
                    "_status": "backfill",
                    "replacement": "app.vitals.frames.total.count",
                },
            }
        ],
    )

    deprecated_internal_attr = attribute_definitions["mobile.total_frames"]
    replacement_attr = attribute_definitions["app.vitals.frames.total.count"]

    assert "frames.total" not in attribute_definitions
    assert deprecated_internal_attr.public_alias == "mobile.total_frames"
    assert deprecated_internal_attr.internal_name == "frames.total"
    assert deprecated_internal_attr.search_type == "number"
    assert deprecated_internal_attr.deprecation_status == "backfill"
    assert deprecated_internal_attr.replacement == "app.vitals.frames.total.count"
    assert replacement_attr.public_alias == "app.vitals.frames.total.count"
    assert replacement_attr.internal_name == "app.vitals.frames.total.count"
    assert replacement_attr.search_type == "number"


def test_deprecated_attribute_internal_name_match_does_not_expose_internal_alias() -> None:
    attribute_definitions = {
        "measurements.fcp": SPAN_ATTRIBUTE_DEFINITIONS["measurements.fcp"],
    }

    _update_attribute_definitions_with_deprecations(
        attribute_definitions,
        [
            {
                "key": "fcp",
                "type": "double",
                "deprecation": {
                    "_status": "backfill",
                    "replacement": "browser.web_vital.fcp.value",
                },
            }
        ],
    )

    deprecated_attr = attribute_definitions["measurements.fcp"]
    replacement_attr = attribute_definitions["browser.web_vital.fcp.value"]

    assert "fcp" not in attribute_definitions
    assert deprecated_attr.public_alias == "measurements.fcp"
    assert deprecated_attr.internal_name == "fcp"
    assert deprecated_attr.search_type == "millisecond"
    assert deprecated_attr.deprecation_status == "backfill"
    assert deprecated_attr.replacement == "browser.web_vital.fcp.value"
    assert replacement_attr.public_alias == "browser.web_vital.fcp.value"
    assert replacement_attr.internal_name == "browser.web_vital.fcp.value"
    assert replacement_attr.search_type == "millisecond"


def test_deprecated_attribute_does_not_overwrite_existing_replacement() -> None:
    attribute_definitions = {
        "mobile.total_frames": SPAN_ATTRIBUTE_DEFINITIONS["mobile.total_frames"],
        "app.vitals.frames.total.count": ResolvedAttribute(
            public_alias="app.vitals.frames.total.count",
            internal_name="app.vitals.frames.total.count",
            search_type="integer",
        ),
    }

    _update_attribute_definitions_with_deprecations(
        attribute_definitions,
        [
            {
                "key": "frames.total",
                "type": "number",
                "deprecation": {
                    "_status": "backfill",
                    "replacement": "app.vitals.frames.total.count",
                },
            }
        ],
    )

    deprecated_internal_attr = attribute_definitions["mobile.total_frames"]
    replacement_attr = attribute_definitions["app.vitals.frames.total.count"]

    assert "frames.total" not in attribute_definitions
    assert deprecated_internal_attr.public_alias == "mobile.total_frames"
    assert deprecated_internal_attr.internal_name == "frames.total"
    assert deprecated_internal_attr.search_type == "number"
    assert deprecated_internal_attr.deprecation_status == "backfill"
    assert deprecated_internal_attr.replacement == "app.vitals.frames.total.count"
    assert replacement_attr.public_alias == "app.vitals.frames.total.count"
    assert replacement_attr.internal_name == "app.vitals.frames.total.count"
    assert replacement_attr.search_type == "integer"
    assert replacement_attr.deprecation_status is None
    assert replacement_attr.replacement is None


def test_deprecated_attribute_normalizes_supported_convention_attribute_types() -> None:
    attribute_definitions: dict[str, ResolvedAttribute] = {}

    _update_attribute_definitions_with_deprecations(
        attribute_definitions,
        [
            {
                "key": "old_string",
                "type": "string",
                "deprecation": {
                    "_status": "backfill",
                    "replacement": "new_string",
                },
            },
            {
                "key": "old_boolean",
                "type": "boolean",
                "deprecation": {
                    "_status": "backfill",
                    "replacement": "new_boolean",
                },
            },
            {
                "key": "old_integer",
                "type": "integer",
                "deprecation": {
                    "_status": "backfill",
                    "replacement": "new_integer",
                },
            },
            {
                "key": "old_double",
                "type": "double",
                "deprecation": {
                    "_status": "backfill",
                    "replacement": "new_double",
                },
            },
        ],
    )

    assert attribute_definitions["old_string"].search_type == "string"
    assert attribute_definitions["new_string"].search_type == "string"

    assert attribute_definitions["old_boolean"].search_type == "boolean"
    assert attribute_definitions["new_boolean"].search_type == "boolean"

    assert attribute_definitions["old_integer"].search_type == "integer"
    assert attribute_definitions["new_integer"].search_type == "integer"

    assert attribute_definitions["old_double"].search_type == "number"
    assert attribute_definitions["new_double"].search_type == "number"
