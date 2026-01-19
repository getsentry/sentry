from datetime import datetime, timedelta, timezone

import pytest
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    ExtrapolationMode,
    Function,
    IntArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.occurrences.definitions import OCCURRENCE_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.occurrences_rpc import Occurrences
from sentry.snuba.rpc_dataset_common import RPCBase
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
