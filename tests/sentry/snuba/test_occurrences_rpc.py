from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import pytest
from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    ExtrapolationMode,
    Function,
    IntArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.occurrences.definitions import OCCURRENCE_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.occurrences_rpc import OccurrenceCategory, Occurrences
from sentry.snuba.rpc_dataset_common import RPCBase
from sentry.testutils.cases import OccurrenceTestCase, SnubaTestCase, TestCase


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

    def test_count_if_aggregate_greater_or_equals(self) -> None:
        # count_if(filter_key, operator, value) uses default aggregate key (group_id)
        resolved_column, virtual_context = self.resolver.resolve_column(
            "count_if(timestamp, greaterOrEquals, 1704067200)"
        )
        assert resolved_column.proto_definition == AttributeConditionalAggregation(
            aggregate=Function.FUNCTION_COUNT,
            key=AttributeKey(name="group_id", type=AttributeKey.Type.TYPE_INT),
            filter=TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(name="sentry.timestamp", type=AttributeKey.Type.TYPE_DOUBLE),
                    op=ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
                    value=AttributeValue(val_double=1704067200.0),
                )
            ),
            label="count_if(timestamp, greaterOrEquals, 1704067200)",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None
        assert resolved_column.public_alias == "count_if(timestamp, greaterOrEquals, 1704067200)"
        assert resolved_column.search_type == "integer"

    def test_count_if_aggregate_less_than(self) -> None:
        # count_if(filter_key, operator, value) uses default aggregate key (group_id)
        resolved_column, virtual_context = self.resolver.resolve_column(
            "count_if(timestamp, less, 1704067200)"
        )
        assert resolved_column.proto_definition == AttributeConditionalAggregation(
            aggregate=Function.FUNCTION_COUNT,
            key=AttributeKey(name="group_id", type=AttributeKey.Type.TYPE_INT),
            filter=TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(name="sentry.timestamp", type=AttributeKey.Type.TYPE_DOUBLE),
                    op=ComparisonFilter.OP_LESS_THAN,
                    value=AttributeValue(val_double=1704067200.0),
                )
            ),
            label="count_if(timestamp, less, 1704067200)",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None
        assert resolved_column.search_type == "integer"

    def test_count_if_aggregate_between(self) -> None:
        # count_if(filter_key, operator, value1, value2) uses default aggregate key (group_id)
        resolved_column, virtual_context = self.resolver.resolve_column(
            "count_if(timestamp, between, 1704067200, 1704153600)"
        )
        assert resolved_column.proto_definition == AttributeConditionalAggregation(
            aggregate=Function.FUNCTION_COUNT,
            key=AttributeKey(name="group_id", type=AttributeKey.Type.TYPE_INT),
            filter=TraceItemFilter(
                and_filter=AndFilter(
                    filters=[
                        TraceItemFilter(
                            comparison_filter=ComparisonFilter(
                                key=AttributeKey(
                                    name="sentry.timestamp", type=AttributeKey.Type.TYPE_DOUBLE
                                ),
                                op=ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
                                value=AttributeValue(val_double=1704067200.0),
                            )
                        ),
                        TraceItemFilter(
                            comparison_filter=ComparisonFilter(
                                key=AttributeKey(
                                    name="sentry.timestamp", type=AttributeKey.Type.TYPE_DOUBLE
                                ),
                                op=ComparisonFilter.OP_LESS_THAN_OR_EQUALS,
                                value=AttributeValue(val_double=1704153600.0),
                            )
                        ),
                    ]
                )
            ),
            label="count_if(timestamp, between, 1704067200, 1704153600)",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None
        assert resolved_column.search_type == "integer"

    def test_count_if_aggregate_invalid_operator(self) -> None:
        with pytest.raises(InvalidSearchQuery):
            self.resolver.resolve_column("count_if(timestamp, invalidOp, 1704067200)")

    def test_count_if_aggregate_between_missing_second_value(self) -> None:
        with pytest.raises(InvalidSearchQuery) as exc_info:
            self.resolver.resolve_column("count_if(timestamp, between, 1704067200)")
        assert "between operator requires two values" in str(exc_info.value)

    def test_count_if_aggregate_between_invalid_order(self) -> None:
        with pytest.raises(InvalidSearchQuery) as exc_info:
            self.resolver.resolve_column("count_if(timestamp, between, 1704153600, 1704067200)")
        assert "must be greater than" in str(exc_info.value)

    def test_min_aggregate(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("min(timestamp)")
        assert resolved_column.proto_definition == AttributeAggregation(
            aggregate=Function.FUNCTION_MIN,
            key=AttributeKey(name="sentry.timestamp", type=AttributeKey.Type.TYPE_DOUBLE),
            label="min(timestamp)",
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
        )
        assert virtual_context is None
        assert resolved_column.public_alias == "min(timestamp)"
        assert resolved_column.search_type == "string"  # timestamp is processed as string

    def test_type_attribute(self) -> None:
        resolved_column, virtual_context = self.resolver.resolve_column("type")
        assert resolved_column.proto_definition == AttributeKey(
            name="type", type=AttributeKey.Type.TYPE_STRING
        )
        assert virtual_context is None

    def test_type_filter_query(self) -> None:
        where, having, _ = self.resolver.resolve_query("type:error")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="type", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="error"),
            )
        )
        assert having is None

    def test_type_negation_filter_query(self) -> None:
        where, having, _ = self.resolver.resolve_query("!type:generic")
        assert where == TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="type", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_NOT_EQUALS,
                value=AttributeValue(val_str="generic"),
            )
        )
        assert having is None


class OccurrencesTimeseriesTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(name="test")
        self.end = datetime.now(timezone.utc)
        self.start = self.end - timedelta(days=1)
        self.snuba_params = SnubaParams(
            start=self.start,
            end=self.end,
            granularity_secs=3600,  # 1 hour buckets
            projects=[self.project],
        )
        self.config = SearchResolverConfig()

    def test_get_timeseries_query_without_groupby(self) -> None:
        """Test that the simple timeseries query is constructed correctly."""
        resolver = Occurrences.get_resolver(self.snuba_params, self.config)

        _rpc_request, aggregates, groupbys = RPCBase.get_timeseries_query(
            search_resolver=resolver,
            params=self.snuba_params,
            query_string="",
            y_axes=["count()"],
            groupby=[],
            referrer="test_referrer",
            sampling_mode=None,
        )

        # Verify no groupby columns
        assert len(groupbys) == 0

        # Verify aggregate is resolved
        assert len(aggregates) == 1
        assert aggregates[0].public_alias == "count()"

    def test_get_timeseries_query_with_groupby(self) -> None:
        """Test that the grouped timeseries query is constructed correctly."""
        resolver = Occurrences.get_resolver(self.snuba_params, self.config)

        rpc_request, aggregates, groupbys = RPCBase.get_timeseries_query(
            search_resolver=resolver,
            params=self.snuba_params,
            query_string="group_id:123",
            y_axes=["count()"],
            groupby=["project_id", "group_id"],
            referrer="test_referrer",
            sampling_mode=None,
        )

        # Verify groupby columns are resolved
        assert len(groupbys) == 2
        assert groupbys[0].public_alias == "project_id"
        assert groupbys[0].internal_name == "sentry.project_id"
        assert groupbys[1].public_alias == "group_id"
        assert groupbys[1].internal_name == "group_id"

        # Verify aggregate is resolved
        assert len(aggregates) == 1
        assert aggregates[0].public_alias == "count()"

        # Verify RPC request has correct granularity
        assert rpc_request.granularity_secs == 3600

    def test_validate_granularity_required_for_timeseries(self) -> None:
        """Test that granularity validation fails without granularity_secs."""
        params_no_granularity = SnubaParams(
            start=self.start,
            end=self.end,
            projects=[self.project],
        )

        with pytest.raises(InvalidSearchQuery):
            Occurrences.run_timeseries_query(
                params=params_no_granularity,
                query_string="",
                y_axes=["count()"],
                referrer="test",
                config=self.config,
                sampling_mode=None,
            )

    def test_validate_granularity_required_for_grouped_timeseries(self) -> None:
        """Test that granularity validation fails without granularity_secs."""
        params_no_granularity = SnubaParams(
            start=self.start,
            end=self.end,
            projects=[self.project],
        )

        with pytest.raises(InvalidSearchQuery):
            Occurrences.run_grouped_timeseries_query(
                params=params_no_granularity,
                query_string="",
                y_axes=["count()"],
                groupby=["project_id", "group_id"],
                referrer="test",
                config=self.config,
            )


class OccurrencesStatsRPCTest(TestCase, SnubaTestCase, OccurrenceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.now = datetime.now(timezone.utc)

    def _query_stats(
        self,
        query_string: str = "",
        stats_types: set[str] | None = None,
        attributes: list[AttributeKey] | None = None,
        max_buckets: int = 75,
        occurrence_category: OccurrenceCategory | None = None,
        skip_translate_internal_to_public_alias: bool = False,
    ) -> list[dict[str, Any]]:
        snuba_params = SnubaParams(
            start=self.now - timedelta(hours=1),
            end=self.now + timedelta(hours=1),
            organization=self.organization,
            projects=[self.project],
        )
        return Occurrences.run_stats_query(
            params=snuba_params,
            stats_types=stats_types or {"attributeDistributions"},
            query_string=query_string,
            referrer="test.eap_occurrences_stats",
            config=SearchResolverConfig(),
            attributes=attributes,
            max_buckets=max_buckets,
            skip_translate_internal_to_public_alias=skip_translate_internal_to_public_alias,
            occurrence_category=occurrence_category,
        )

    def test_stats_returns_attribute_distributions(self) -> None:
        group = self.create_group(project=self.project)
        for level in ["error", "error", "warning"]:
            occ = self.create_eap_occurrence(
                group_id=group.id,
                level=level,
                timestamp=self.now - timedelta(minutes=5),
            )
            self.store_eap_items([occ])

        result = self._query_stats()
        assert len(result) == 1
        assert "attribute_distributions" in result[0]
        data = result[0]["attribute_distributions"]["data"]
        assert "level" in data
        level_buckets = data["level"]
        labels = {bucket["label"] for bucket in level_buckets}
        assert "error" in labels
        assert "warning" in labels

    def test_stats_with_query_filter(self) -> None:
        group = self.create_group(project=self.project)
        for level in ["error", "warning"]:
            occ = self.create_eap_occurrence(
                group_id=group.id,
                level=level,
                timestamp=self.now - timedelta(minutes=5),
            )
            self.store_eap_items([occ])

        result = self._query_stats(query_string="level:error")
        assert len(result) == 1
        data = result[0]["attribute_distributions"]["data"]
        # With the filter, only error occurrences are included
        assert "level" in data
        labels = {bucket["label"] for bucket in data["level"]}
        assert "error" in labels
        assert "warning" not in labels

    def test_stats_with_specific_attributes(self) -> None:
        group = self.create_group(project=self.project)
        occ = self.create_eap_occurrence(
            group_id=group.id,
            level="error",
            timestamp=self.now - timedelta(minutes=5),
        )
        self.store_eap_items([occ])

        result = self._query_stats(
            attributes=[AttributeKey(name="level", type=AttributeKey.TYPE_STRING)],
        )
        assert len(result) == 1
        data = result[0]["attribute_distributions"]["data"]
        assert "level" in data

    def test_stats_excludes_private_attributes(self) -> None:
        group = self.create_group(project=self.project)
        occ = self.create_eap_occurrence(
            group_id=group.id,
            level="error",
            timestamp=self.now - timedelta(minutes=5),
        )
        self.store_eap_items([occ])

        result = self._query_stats()
        assert len(result) == 1
        data = result[0]["attribute_distributions"]["data"]
        # Private attributes should not appear
        assert "sentry.item_type" not in data
        assert "sentry.organization_id" not in data

    def test_stats_with_occurrence_category_filter(self) -> None:
        group_error = self.create_group(project=self.project)
        group_generic = self.create_group(project=self.project)

        # Error events have no issue_occurrence_id
        error_occ = self.create_eap_occurrence(
            group_id=group_error.id,
            level="error",
            timestamp=self.now - timedelta(minutes=5),
        )
        # Issue platform events have an issue_occurrence_id
        generic_occ = self.create_eap_occurrence(
            group_id=group_generic.id,
            level="warning",
            issue_occurrence_id=uuid4().hex,
            timestamp=self.now - timedelta(minutes=5),
        )
        self.store_eap_items([error_occ, generic_occ])

        # Filter to only error category
        result = self._query_stats(occurrence_category=OccurrenceCategory.ERROR)
        assert len(result) == 1
        data = result[0]["attribute_distributions"]["data"]
        assert "level" in data
        labels = {bucket["label"] for bucket in data["level"]}
        assert "error" in labels
        assert "warning" not in labels

    def test_stats_unsupported_stats_type(self) -> None:
        result = self._query_stats(stats_types={"unsupported"})
        assert result == []

    def test_stats_empty_results(self) -> None:
        result = self._query_stats(query_string="level:nonexistent")
        assert len(result) == 1
        data = result[0]["attribute_distributions"]["data"]
        assert len(data) == 0
