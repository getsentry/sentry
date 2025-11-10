from dataclasses import dataclass
from typing import Literal, cast

from rest_framework.request import Request
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig

MetricType = Literal["counter", "gauge", "distribution"]


@dataclass(frozen=True, kw_only=True)
class TraceMetricsSearchResolverConfig(SearchResolverConfig):
    metric_name: str | None
    metric_type: MetricType | None
    metric_unit: str | None

    def extra_conditions(self, search_resolver: SearchResolver) -> TraceItemFilter | None:
        if not self.metric_name or not self.metric_type:
            return None

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
                    value=AttributeValue(val_str=self.metric_name),
                )
            ),
            TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=metric_type.proto_definition,
                    op=ComparisonFilter.OP_EQUALS,
                    value=AttributeValue(val_str=self.metric_type),
                )
            ),
        ]

        if self.metric_unit:
            metric_unit, _ = search_resolver.resolve_column("metric.unit")
            if not isinstance(metric_unit.proto_definition, AttributeKey):
                raise ValueError("Unable to resolve metric.unit")
            filters.append(
                TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=metric_unit.proto_definition,
                        op=ComparisonFilter.OP_EQUALS,
                        value=AttributeValue(val_str=self.metric_unit),
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
