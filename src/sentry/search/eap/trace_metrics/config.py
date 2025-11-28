from dataclasses import dataclass
from typing import cast

from rest_framework.request import Request
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    ExistsFilter,
    TraceItemFilter,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import ResolvedArguments
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import MetricType, SearchResolverConfig


@dataclass(frozen=True, kw_only=True)
class Metric:
    metric_name: str
    metric_type: MetricType
    metric_unit: str | None


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

        return None

    def _extra_conditions_from_metric(
        self,
        search_resolver: SearchResolver,
    ) -> TraceItemFilter | None:
        if not self.metric_name or not self.metric_type:
            return None

        metric = Metric(
            metric_name=self.metric_name,
            metric_type=self.metric_type,
            metric_unit=self.metric_unit,
        )

        return get_metric_filter(search_resolver, metric)


def get_metric_filter(
    search_resolver: SearchResolver,
    metric: Metric | None,
) -> TraceItemFilter:
    if metric is None:
        # no metric was specified so we assume they meant to query all metrics
        org_col, _ = search_resolver.resolve_column("organization.id")
        if not isinstance(org_col.proto_definition, AttributeKey):
            raise ValueError("Unable to resolve organization.id")
        # using org id exists as a dummy condition as it's always true
        return TraceItemFilter(exists_filter=ExistsFilter(key=org_col.proto_definition))

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


def resolve_metric_arguments(args: ResolvedArguments) -> tuple[AttributeKey, Metric | None]:
    if not isinstance(args[0], AttributeKey):
        raise InvalidSearchQuery("Not a valid attribute")

    attribute_key: AttributeKey = args[0]

    metric_name = None
    metric_type = None
    metric_unit = None

    if all(isinstance(arg, str) and arg != "" for arg in args[1:]):
        # a metric was passed
        metric_name = cast(str, args[1])
        metric_type = cast(MetricType, args[2])
        metric_unit = None if args[3] == "-" else cast(str, args[3])

        metric = Metric(
            metric_name=metric_name,
            metric_type=metric_type,
            metric_unit=metric_unit,
        )
        return attribute_key, metric

    if all(arg == "" for arg in args[1:]):
        # no metrics were specified, assume we query all metrics
        return attribute_key, None

    raise InvalidSearchQuery(
        f"Trace metric aggregates expect the full metric to be specified, got name:{args[1]} type:{args[2]} unit:{args[3]}"
    )


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
