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
from sentry.search.eap.columns import ResolvedMetricAggregate
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import MetricType, SearchResolverConfig
from sentry.search.events import fields

Metric = tuple[str, MetricType, str | None]


@dataclass(frozen=True, kw_only=True)
class TraceMetricsSearchResolverConfig(SearchResolverConfig):
    metric_name: str | None
    metric_type: MetricType | None
    metric_unit: str | None

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
        selected_metrics: set[Metric] = set()

        if selected_columns:
            stripped_columns = [column.strip() for column in selected_columns]
            for column in stripped_columns:
                match = fields.is_function(column)
                if not match:
                    continue

                resolved_function, _ = search_resolver.resolve_function(column)
                if not isinstance(resolved_function, ResolvedMetricAggregate):
                    continue

                if not resolved_function.metric_name or not resolved_function.metric_type:
                    continue

                metric: Metric = (
                    resolved_function.metric_name,
                    resolved_function.metric_type,
                    resolved_function.metric_unit,
                )
                selected_metrics.add(metric)

        if not selected_metrics:
            return None

        if len(selected_metrics) > 1:
            raise InvalidSearchQuery("Cannot aggregate multiple metrics in 1 query.")

        selected_metric = selected_metrics.pop()

        return get_metric_filter(
            search_resolver, selected_metric[0], selected_metric[1], selected_metric[2]
        )

    def _extra_conditions_from_metric(
        self,
        search_resolver: SearchResolver,
    ) -> TraceItemFilter | None:
        if not self.metric_name or not self.metric_type:
            return None

        return get_metric_filter(
            search_resolver, self.metric_name, self.metric_type, self.metric_unit
        )


def get_metric_filter(
    search_resolver: SearchResolver,
    name: str,
    type: MetricType,
    unit: str | None,
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
                value=AttributeValue(val_str=name),
            )
        ),
        TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=metric_type.proto_definition,
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str=type),
            )
        ),
    ]

    if unit:
        metric_unit, _ = search_resolver.resolve_column("metric.unit")
        if not isinstance(metric_unit.proto_definition, AttributeKey):
            raise ValueError("Unable to resolve metric.unit")
        filters.append(
            TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=metric_unit.proto_definition,
                    op=ComparisonFilter.OP_EQUALS,
                    value=AttributeValue(val_str=unit),
                )
            )
        )

    return TraceItemFilter(and_filter=AndFilter(filters=filters))


ALLOWED_METRIC_TYPES: list[MetricType] = ["counter", "gauge", "distribution"]


def get_trace_metric_from_request(
    request: Request,
) -> tuple[str | None, MetricType | None, str | None]:
    metric_name = request.GET.get("metricName")
    metric_type = request.GET.get("metricType")
    metric_unit = request.GET.get("metricUnit")

    if not metric_name:
        metric_name = None
    if not metric_type:
        metric_type = None
    if not metric_unit:
        metric_unit = None

    return metric_name, cast(MetricType | None, metric_type), metric_unit
