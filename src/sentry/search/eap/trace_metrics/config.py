from dataclasses import dataclass
from typing import cast

from rest_framework.request import Request
from sentry_protos.snuba.v1.trace_item_filter_pb2 import TraceItemFilter

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import ResolvedTraceMetricAggregate, ResolvedTraceMetricFormula
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
        aggregate_all_metrics = False
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

                if resolved_function.trace_metric is None:
                    # found an aggregation across all metrics, not just 1
                    aggregate_all_metrics = True
                    continue

                selected_metrics.add(resolved_function.trace_metric)

        if equations:
            raise InvalidSearchQuery("Cannot support equations on trace metrics yet")

        # no selected metrics, no filter needed
        if not selected_metrics:
            return None

        # check if there are any aggregations across all metrics mixed with
        # aggregations for a single metric as this is not permitted
        if aggregate_all_metrics and selected_metrics:
            raise InvalidSearchQuery(
                "Cannot aggregate all metrics and singlular metrics in the same query."
            )

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
