from datetime import datetime, timedelta, timezone

import pytest
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.search.eap.columns import ResolvedTraceMetricAggregate
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.trace_metrics.config import TraceMetricsSearchResolverConfig
from sentry.search.eap.trace_metrics.definitions import TRACE_METRICS_DEFINITIONS
from sentry.search.eap.types import SupportedTraceItemType
from sentry.search.eap.utils import can_expose_attribute, can_expose_attribute_to_api
from sentry.search.events.types import SnubaParams

VALUE_KEY = AttributeKey(name="sentry.value", type=AttributeKey.Type.TYPE_DOUBLE)


@pytest.fixture
def resolver() -> SearchResolver:
    return SearchResolver(
        params=SnubaParams(
            start=datetime(2026, 1, 1, tzinfo=timezone.utc),
            end=datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(hours=1),
        ),
        config=TraceMetricsSearchResolverConfig(metric=None),
        definitions=TRACE_METRICS_DEFINITIONS,
    )


@pytest.mark.parametrize(
    "column",
    [
        "count(value)",
        "count(value,my.latency,histogram,millisecond)",
        "count(value,my.latency,distribution,millisecond)",
        "count(metric.name,my.latency,histogram,millisecond)",
    ],
)
def test_count_resolves_to_value(resolver: SearchResolver, column: str) -> None:
    resolved, _ = resolver.resolve_column(column)
    assert isinstance(resolved, ResolvedTraceMetricAggregate)
    assert resolved.key == VALUE_KEY


def test_count_if_resolves_to_value(resolver: SearchResolver) -> None:
    resolved, _ = resolver.resolve_column(
        "count_if(`row_kind:bucket`,value,my.latency,histogram,millisecond)"
    )
    assert isinstance(resolved, ResolvedTraceMetricAggregate)
    assert resolved.key == VALUE_KEY


def test_histogram_metric_type_accepted(resolver: SearchResolver) -> None:
    resolved, _ = resolver.resolve_column("p95(value,my.latency,histogram,millisecond)")
    assert isinstance(resolved, ResolvedTraceMetricAggregate)
    assert resolved.trace_metric is not None
    assert resolved.trace_metric.metric_type == "histogram"
    assert resolved.key == VALUE_KEY


def test_per_second_histogram_counts_value(resolver: SearchResolver) -> None:
    resolved, _ = resolver.resolve_column("per_second(value,my.latency,histogram,millisecond)")
    formula = resolved.proto_definition
    assert isinstance(formula, Column.BinaryFormula)
    assert formula.left.conditional_aggregation.key == VALUE_KEY


@pytest.mark.parametrize(
    ("alias", "internal_name", "attribute_type"),
    [
        ("point_id", "sentry._internal.point_id", AttributeKey.Type.TYPE_STRING),
        ("row_kind", "sentry._internal.row_kind", AttributeKey.Type.TYPE_STRING),
        ("bucket.lower", "sentry._internal.bucket_lower", AttributeKey.Type.TYPE_DOUBLE),
        ("bucket.upper", "sentry._internal.bucket_upper", AttributeKey.Type.TYPE_DOUBLE),
        ("bucket.count", "sentry._internal.bucket_count", AttributeKey.Type.TYPE_INT),
        ("sum_share", "sentry._internal.sum_share", AttributeKey.Type.TYPE_DOUBLE),
        ("histogram.count", "sentry._internal.histogram_count", AttributeKey.Type.TYPE_INT),
        ("histogram.sum", "sentry._internal.histogram_sum", AttributeKey.Type.TYPE_DOUBLE),
        ("histogram.min", "sentry._internal.histogram_min", AttributeKey.Type.TYPE_DOUBLE),
        ("histogram.max", "sentry._internal.histogram_max", AttributeKey.Type.TYPE_DOUBLE),
    ],
)
def test_histogram_row_aliases(
    resolver: SearchResolver,
    alias: str,
    internal_name: str,
    attribute_type: AttributeKey.Type.ValueType,
) -> None:
    resolved, _ = resolver.resolve_column(alias)
    assert resolved.proto_definition == AttributeKey(name=internal_name, type=attribute_type)
    assert can_expose_attribute(internal_name, SupportedTraceItemType.TRACEMETRICS)
    assert can_expose_attribute_to_api(alias, SupportedTraceItemType.TRACEMETRICS)


def test_row_kind_filter(resolver: SearchResolver) -> None:
    where, having, _ = resolver.resolve_query("row_kind:exemplar")
    assert where == TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=AttributeKey(name="sentry._internal.row_kind", type=AttributeKey.Type.TYPE_STRING),
            op=ComparisonFilter.OP_EQUALS,
            value=AttributeValue(val_str="exemplar"),
        )
    )
    assert having is None


def test_other_internal_attributes_stay_hidden() -> None:
    assert not can_expose_attribute(
        "sentry._internal.histogram_sum_missing", SupportedTraceItemType.TRACEMETRICS
    )
