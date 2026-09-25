import logging
from collections.abc import Mapping
from datetime import timedelta
from typing import Any

import sentry_sdk
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.api.helpers.error_upsampling import (
    is_errors_query_for_error_upsampled_projects,
    transform_query_columns_for_error_upsampling,
)
from sentry.api.serializers.snuba import StatsTimeSeriesResult
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import MAX_TOP_EVENTS
from sentry.models.organization import Organization
from sentry.search.eap.preprod_size.config import PreprodSizeSearchResolverConfig
from sentry.search.eap.trace_metrics.config import (
    TraceMetricsSearchResolverConfig,
    get_trace_metric_from_request,
)
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba import (
    discover,
    errors,
    functions,
    metrics_enhanced_performance,
    metrics_performance,
    spans_metrics,
    transactions,
)
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.preprod_size import PreprodSize
from sentry.snuba.processing_errors_rpc import ProcessingErrors
from sentry.snuba.profile_functions import ProfileFunctions
from sentry.snuba.query_sources import QuerySource
from sentry.snuba.referrer import Referrer, is_valid_referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.snuba.utils import RPC_DATASETS
from sentry.utils.snuba import SnubaTSResult
from sentry.utils.tracing import set_span_data, start_span

SENTRY_BACKEND_REFERRERS = [
    Referrer.API_ALERTS_CHARTCUTERIE.value,
    Referrer.API_ENDPOINT_REGRESSION_ALERT_CHARTCUTERIE.value,
    Referrer.API_FUNCTION_REGRESSION_ALERT_CHARTCUTERIE.value,
    Referrer.DASHBOARDS_SLACK_UNFURL.value,
    Referrer.DISCOVER_SLACK_UNFURL.value,
    Referrer.EXPLORE_SLACK_UNFURL.value,
]

logger = logging.getLogger(__name__)


@cell_silo_endpoint
class OrganizationEventsStatsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get_features(
        self, organization: Organization, request: Request
    ) -> Mapping[str, bool | None]:
        feature_names = [
            "organizations:on-demand-metrics-extraction",
            "organizations:on-demand-metrics-extraction-widgets",
        ]
        batch_features = features.batch_has(
            feature_names,
            organization=organization,
            actor=request.user,
        )
        return (
            batch_features.get(f"organization:{organization.id}", {})
            if batch_features is not None
            else {
                feature_name: features.has(
                    feature_name, organization=organization, actor=request.user
                )
                for feature_name in feature_names
            }
        )

    @extend_schema(
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEventsStatsResponse",
                StatsTimeSeriesResult | dict[str, StatsTimeSeriesResult],
            )
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        query_source = self.get_request_source(request)
        logger.info(
            "An events-stats request was made",
            extra={
                "referrer": request.GET.get("referrer"),
                "organization.id": organization.id,
                "dataset_label": request.GET.get("dataset"),
                "external_call": bool(request.auth),
            },
        )

        with start_span(op="discover.endpoint", name="filter_params") as span:
            set_span_data(span, "organization", organization)

            top_events = 0

            if "topEvents" in request.GET:
                try:
                    top_events = int(request.GET.get("topEvents", 0))
                except ValueError:
                    return Response({"detail": "topEvents must be an integer"}, status=400)
                if top_events > MAX_TOP_EVENTS:
                    return Response(
                        {"detail": f"Can only get up to {MAX_TOP_EVENTS} top events"},
                        status=400,
                    )
                elif top_events <= 0:
                    return Response({"detail": "topEvents needs to be at least 1"}, status=400)

            comparison_delta = None
            if "comparisonDelta" in request.GET:
                try:
                    comparison_delta = timedelta(seconds=int(request.GET["comparisonDelta"]))
                except ValueError:
                    return Response({"detail": "comparisonDelta must be an integer"}, status=400)

            # The partial parameter determines whether or not partial buckets are allowed.
            # The last bucket of the time series can potentially be a partial bucket when
            # the start of the bucket does not align with the rollup.
            allow_partial_buckets = request.GET.get("partial") == "1"

            include_other = request.GET.get("excludeOther") != "1"

            referrer = request.GET.get("referrer")

            # Force the referrer to "api.auth-token.events" for events requests authorized through a bearer token
            if request.auth:
                referrer = Referrer.API_AUTH_TOKEN_EVENTS.value
            elif referrer is None or not referrer:
                referrer = Referrer.API_ORGANIZATION_EVENTS.value
            elif not is_valid_referrer(referrer):
                referrer = Referrer.API_ORGANIZATION_EVENTS.value
            if referrer in SENTRY_BACKEND_REFERRERS:
                query_source = QuerySource.SENTRY_BACKEND

            batch_features = self.get_features(organization, request)

            dataset = self.get_dataset(request, organization)
            # Add more here until top events is supported on all the datasets
            if top_events > 0:
                dataset = (
                    dataset
                    if dataset
                    in [
                        discover,
                        functions,
                        metrics_performance,
                        metrics_enhanced_performance,
                        spans_metrics,
                        Spans,
                        OurLogs,
                        ProfileFunctions,
                        PreprodSize,
                        ProcessingErrors,
                        TraceMetrics,
                        errors,
                        transactions,
                    ]
                    else discover
                )

            metrics_enhanced = dataset in {metrics_performance, metrics_enhanced_performance}

            allow_metric_aggregates = request.GET.get("preventMetricAggregates") != "1"
            sentry_sdk.set_tag("performance.metrics_enhanced", metrics_enhanced)
            sentry_sdk.set_attribute("performance.metrics_enhanced", metrics_enhanced)

        try:
            use_on_demand_metrics, on_demand_metrics_type = self.handle_on_demand(request)
        except ValueError:
            metric_type_values = [e.value for e in MetricSpecType]
            metric_types = ",".join(metric_type_values)
            return Response({"detail": f"Metric type must be one of: {metric_types}"}, status=400)

        use_rpc = dataset in RPC_DATASETS
        transform_alias_to_input_format = (
            request.GET.get("transformAliasToInputFormat") == "1" or use_rpc
        )

        def _get_event_stats(
            scoped_dataset: Any,
            query_columns: list[str],
            query: str,
            snuba_params: SnubaParams,
            rollup: int,
            zerofill_results: bool,
            comparison_delta: timedelta | None,
        ) -> SnubaTSResult | dict[str, SnubaTSResult]:
            should_upsample = is_errors_query_for_error_upsampled_projects(
                snuba_params, organization, dataset, request
            )
            final_columns = query_columns
            if should_upsample:
                final_columns = transform_query_columns_for_error_upsampling(query_columns)

            def get_rpc_config():
                if scoped_dataset not in RPC_DATASETS:
                    raise NotImplementedError

                extrapolation_mode = self.get_extrapolation_mode(request)
                disable_array_attributes = not features.has(
                    "organizations:trace-item-details-array-fields",
                    organization,
                    actor=request.user,
                )

                if scoped_dataset == TraceMetrics:
                    # tracemetrics uses aggregate conditions
                    metric = get_trace_metric_from_request(request)

                    return TraceMetricsSearchResolverConfig(
                        metric=metric,
                        auto_fields=False,
                        use_aggregate_conditions=True,
                        disable_aggregate_extrapolation=request.GET.get(
                            "disableAggregateExtrapolation", "0"
                        )
                        == "1",
                        extrapolation_mode=extrapolation_mode,
                        disable_array_attributes=disable_array_attributes,
                    )

                if scoped_dataset == PreprodSize:
                    return PreprodSizeSearchResolverConfig(
                        auto_fields=False,
                        use_aggregate_conditions=True,
                        disable_aggregate_extrapolation=request.GET.get(
                            "disableAggregateExtrapolation", "0"
                        )
                        == "1",
                        extrapolation_mode=extrapolation_mode,
                        disable_array_attributes=disable_array_attributes,
                    )

                return SearchResolverConfig(
                    auto_fields=False,
                    use_aggregate_conditions=True,
                    disable_aggregate_extrapolation=request.GET.get(
                        "disableAggregateExtrapolation", "0"
                    )
                    == "1",
                    extrapolation_mode=extrapolation_mode,
                    disable_array_attributes=disable_array_attributes,
                )

            if top_events > 0:
                raw_groupby = self.get_field_list(organization, request)
                if "timestamp" in raw_groupby:
                    raise ParseError("Cannot group by timestamp")
                if use_rpc:
                    return scoped_dataset.run_top_events_timeseries_query(
                        params=snuba_params,
                        query_string=query,
                        y_axes=final_columns,
                        raw_groupby=raw_groupby,
                        orderby=self.get_orderby(request),
                        limit=top_events,
                        include_other=include_other,
                        referrer=referrer,
                        config=get_rpc_config(),
                        sampling_mode=snuba_params.sampling_mode,
                        equations=self.get_equation_list(organization, request),
                    )
                return scoped_dataset.top_events_timeseries(
                    timeseries_columns=final_columns,
                    selected_columns=raw_groupby,
                    equations=self.get_equation_list(organization, request),
                    user_query=query,
                    snuba_params=snuba_params,
                    orderby=self.get_orderby(request),
                    rollup=rollup,
                    limit=top_events,
                    organization=organization,
                    referrer=referrer + ".find-topn",
                    allow_empty=False,
                    zerofill_results=zerofill_results,
                    on_demand_metrics_enabled=use_on_demand_metrics,
                    on_demand_metrics_type=on_demand_metrics_type,
                    include_other=include_other,
                    query_source=query_source,
                    transform_alias_to_input_format=transform_alias_to_input_format,
                    fallback_to_transactions=True,
                )

            if use_rpc:
                return scoped_dataset.run_timeseries_query(
                    params=snuba_params,
                    query_string=query,
                    y_axes=final_columns,
                    referrer=referrer,
                    config=get_rpc_config(),
                    sampling_mode=snuba_params.sampling_mode,
                    comparison_delta=comparison_delta,
                )

            return scoped_dataset.timeseries_query(
                selected_columns=final_columns,
                query=query,
                snuba_params=snuba_params,
                rollup=rollup,
                referrer=referrer,
                zerofill_results=zerofill_results,
                comparison_delta=comparison_delta,
                allow_metric_aggregates=allow_metric_aggregates,
                has_metrics=True,
                on_demand_metrics_enabled=use_on_demand_metrics
                and (
                    batch_features.get("organizations:on-demand-metrics-extraction", False)
                    or batch_features.get(
                        "organizations:on-demand-metrics-extraction-widgets", False
                    )
                ),
                on_demand_metrics_type=on_demand_metrics_type,
                query_source=query_source,
                fallback_to_transactions=True,
                transform_alias_to_input_format=transform_alias_to_input_format,
            )

        def get_event_stats(
            query_columns: list[str],
            query: str,
            snuba_params: SnubaParams,
            rollup: int,
            zerofill_results: bool,
            comparison_delta: timedelta | None,
        ) -> SnubaTSResult | dict[str, SnubaTSResult]:
            return _get_event_stats(
                dataset,
                query_columns,
                query,
                snuba_params,
                rollup,
                zerofill_results,
                comparison_delta,
            )

        # The rpc will usually zerofill for us so we don't need to do it ourselves
        zerofill_results = not use_rpc

        try:
            return Response(
                self.get_event_stats_data(
                    request,
                    organization,
                    get_event_stats,
                    top_events,
                    allow_partial_buckets=allow_partial_buckets,
                    zerofill_results=zerofill_results,
                    comparison_delta=comparison_delta,
                    dataset=dataset,
                    transform_alias_to_input_format=transform_alias_to_input_format,
                    use_rpc=use_rpc,
                ),
                status=200,
            )
        except ValidationError:
            return Response({"detail": "Comparison period is outside retention window"}, status=400)
