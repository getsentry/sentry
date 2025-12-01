from dataclasses import dataclass
from typing import cast

from rest_framework.request import Request
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import ResolvedTraceMetricAggregate, ResolvedTraceMetricFormula
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.trace_metrics.types import TraceMetric, TraceMetricType
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events import fields


@dataclass(frozen=True, kw_only=True)
class TraceMetricsSearchResolverConfig(SearchResolverConfig):
    metric: TraceMetric | None

    def extra_conditions(
        self,
        search_resolver: SearchResolver,
        selected_columns: list[str] | None,
        equations: list[str] | None,
    ) -> TraceItemFilter | None:
        # use the metric from the config first if it exists
        if extra_conditions := self._extra_conditions_from_metric(search_resolver):
            return extra_conditions

        # then try to parse metric from the aggregations
        if extra_conditions := self._extra_conditions_from_columns(
            search_resolver, selected_columns, equations
        ):
            return extra_conditions

        return None

    def _extra_conditions_from_columns(
        self,
        search_resolver: SearchResolver,
        selected_columns: list[str] | None,
        equations: list[str] | None,
    ) -> TraceItemFilter | None:
        selected_metrics: set[TraceMetric] = set()

        if selected_columns:
            stripped_columns = [column.strip() for column in selected_columns]
            for column in stripped_columns:
                match = fields.is_function(column)
                if not match:
                    continue

                resolved_function, _ = search_resolver.resolve_function(column)

                if not isinstance(
                    resolved_function, ResolvedTraceMetricAggregate
                ) and not isinstance(resolved_function, ResolvedTraceMetricFormula):
                    continue

                if not resolved_function.trace_metric:
                    continue

                selected_metrics.add(resolved_function.trace_metric)

        if not selected_metrics:
            return None

        if len(selected_metrics) > 1:
            raise InvalidSearchQuery("Cannot aggregate multiple metrics in 1 query.")

        selected_metric = selected_metrics.pop()

        return get_metric_filter(search_resolver, selected_metric)

    def _extra_conditions_from_metric(
        self,
        search_resolver: SearchResolver,
    ) -> TraceItemFilter | None:
        if self.metric is None:
            return None
        return get_metric_filter(search_resolver, self.metric)


def get_metric_filter(
    search_resolver: SearchResolver,
    metric: TraceMetric,
) -> TraceItemFilter:
    metric_name, _ = search_resolver.resolve_column("metric.name")
    if not isinstance(metric_name.proto_definition, AttributeKey):
        raise ValueError("Unable to resolve metric.name")

    metric_type, _ = search_resolver.resolve_column("metric.type")
    if not isinstance(metric_type.proto_definition, AttributeKey):
        raise ValueError("Unable to resolve metric.type")

    filters = [
        TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=metric_name.proto_definition,
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str=metric.metric_name),
            )
        ),
        TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=metric_type.proto_definition,
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str=metric.metric_type),
            )
        ),
    ]

    if metric.metric_unit:
        metric_unit, _ = search_resolver.resolve_column("metric.unit")
        if not isinstance(metric_unit.proto_definition, AttributeKey):
            raise ValueError("Unable to resolve metric.unit")
        filters.append(
            TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=metric_unit.proto_definition,
                    op=ComparisonFilter.OP_EQUALS,
                    value=AttributeValue(val_str=metric.metric_unit),
                )
            )
        )

    return TraceItemFilter(and_filter=AndFilter(filters=filters))


ALLOWED_METRIC_TYPES: list[TraceMetricType] = ["counter", "gauge", "distribution"]


def get_trace_metric_from_request(
    request: Request,
) -> TraceMetric | None:
    metric_name = request.GET.get("metricName")
    metric_type = request.GET.get("metricType")
    metric_unit = request.GET.get("metricUnit")

    if not metric_name:
        return None
    if not metric_type or metric_type not in ALLOWED_METRIC_TYPES:
        return None
    if not metric_unit:
        metric_unit = None

    return TraceMetric(
        metric_name=metric_name,
        metric_type=cast(TraceMetricType, metric_type),
        metric_unit=metric_unit,
    )
