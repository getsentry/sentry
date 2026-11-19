from dataclasses import dataclass

from rest_framework.request import Request
from sentry_protos.snuba.v1.trace_item_filter_pb2 import TraceItemFilter

from sentry.discover.arithmetic import parse_arithmetic
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import (
    ResolvedMultiTraceMetricFormula,
    ResolvedTraceMetricAggregate,
    ResolvedTraceMetricFormula,
)
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.rpc_utils import or_trace_item_filters
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
        where: TraceItemFilter | None = None,
    ) -> TraceItemFilter | None:
        # the aggregations can still be histograms when the config has a metric, so check them
        if where is not None and _filters_on_value(where):
            self._extra_conditions_from_columns(search_resolver, selected_columns, equations, where)

        # use the metric from the config first if it exists
        if extra_conditions := self._extra_conditions_from_metric(search_resolver):
            return extra_conditions

        # then try to parse metric from the aggregations
        if extra_conditions := self._extra_conditions_from_columns(
            search_resolver, selected_columns, equations, where
        ):
            return extra_conditions

        return None

    def _extra_conditions_from_columns(
        self,
        search_resolver: SearchResolver,
        selected_columns: list[str] | None,
        equations: list[str] | None,
        where: TraceItemFilter | None,
    ) -> TraceItemFilter | None:
        """While we also add the metric conditions inside -if combinators for each aggregate, adding it to the top level
        where should help clickhouse prune more rows"""
        aggregate_all_metrics = False
        selected_metrics: set[TraceMetric] = set()
        columns: set[str] = set()
        from sentry.search.eap.trace_metrics.definitions import TRACE_METRICS_DEFINITIONS

        if selected_columns:
            stripped_columns = [column.strip() for column in selected_columns]
            for column in stripped_columns:
                match = fields.is_function(column)
                if match:
                    columns.add(column)

        if equations:
            for equation in equations:
                _, _, terms = parse_arithmetic(equation, definitions=TRACE_METRICS_DEFINITIONS)
                for term in terms:
                    columns.add(term)

        for column in columns:
            resolved_function, _ = search_resolver.resolve_function(column)

            if isinstance(resolved_function, ResolvedMultiTraceMetricFormula):
                selected_metrics.update(resolved_function.trace_metrics)
                continue

            if not isinstance(resolved_function, ResolvedTraceMetricAggregate) and not isinstance(
                resolved_function, ResolvedTraceMetricFormula
            ):
                continue

            if resolved_function.trace_metric is None:
                # found an aggregation across all metrics, not just 1
                aggregate_all_metrics = True
                continue

            selected_metrics.add(resolved_function.trace_metric)

        # no selected metrics, no filter needed
        if not selected_metrics:
            return None

        # check if there are any aggregations across all metrics mixed with
        # aggregations for a single metric as this is not permitted
        if aggregate_all_metrics and selected_metrics:
            raise InvalidSearchQuery(
                "Cannot aggregate all metrics and singlular metrics in the same query."
            )

        # Snuba applies the where to a histogram row's mean, not to each of its buckets
        if (
            where is not None
            and _filters_on_value(where)
            and any(metric.metric_type == "histogram" for metric in selected_metrics)
        ):
            raise InvalidSearchQuery("Filtering on value is not supported for histogram metrics")

        # at this point we only have selected metrics remaining
        filters = [metric.get_filter() for metric in selected_metrics]
        return or_trace_item_filters(*filters)

    def _extra_conditions_from_metric(
        self,
        search_resolver: SearchResolver,
    ) -> TraceItemFilter | None:
        if self.metric is None:
            return None
        return self.metric.get_filter()


def _filters_on_value(trace_filter: TraceItemFilter) -> bool:
    match trace_filter.WhichOneof("value"):
        case "and_filter":
            return any(_filters_on_value(f) for f in trace_filter.and_filter.filters)
        case "or_filter":
            return any(_filters_on_value(f) for f in trace_filter.or_filter.filters)
        case "not_filter":
            return any(_filters_on_value(f) for f in trace_filter.not_filter.filters)
        case "comparison_filter":
            return trace_filter.comparison_filter.key.name == "sentry.value"
        case "exists_filter":
            return trace_filter.exists_filter.key.name == "sentry.value"
    return False


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
        metric_type=metric_type,
        metric_unit=metric_unit,
    )
