from collections.abc import Mapping
from datetime import timedelta
from typing import Any

import sentry_sdk
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.api.helpers.error_upsampling import (
    is_errors_query_for_error_upsampled_projects,
    transform_query_columns_for_error_upsampling,
)
from sentry.constants import MAX_TOP_EVENTS
from sentry.models.dashboard_widget import DashboardWidget, DashboardWidgetTypes
from sentry.models.organization import Organization
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
    spans_indexed,
    spans_metrics,
    transactions,
)
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.preprod_size import PreprodSize
from sentry.snuba.profile_functions import ProfileFunctions
from sentry.snuba.query_sources import QuerySource
from sentry.snuba.referrer import Referrer, is_valid_referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.snuba.utils import RPC_DATASETS
from sentry.utils.snuba import SnubaError, SnubaTSResult

SENTRY_BACKEND_REFERRERS = [
    Referrer.API_ALERTS_CHARTCUTERIE.value,
    Referrer.API_ENDPOINT_REGRESSION_ALERT_CHARTCUTERIE.value,
    Referrer.API_FUNCTION_REGRESSION_ALERT_CHARTCUTERIE.value,
    Referrer.DISCOVER_SLACK_UNFURL.value,
]


@region_silo_endpoint
class OrganizationEventsStatsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get_features(
        self, organization: Organization, request: Request
    ) -> Mapping[str, bool | None]:
        feature_names = [
            "organizations:performance-use-metrics",
            "organizations:dashboards-mep",
            "organizations:mep-rollout-flag",
            "organizations:use-metrics-layer",
            "organizations:starfish-view",
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

    def flatten_results(self, results: SnubaTSResult | dict[str, SnubaTSResult]):
        if isinstance(results, SnubaTSResult):
            return results.data["data"]
        else:
            return sum(
                [timeseries_result.data["data"] for timeseries_result in results.values()],
                [],
            )

    def check_if_results_have_data(self, results: SnubaTSResult | dict[str, SnubaTSResult]):
        flattened_data = self.flatten_results(results)
        has_data = any(
            any(
                column_name != "time"
                and isinstance(column_value, (int, float))
                and column_value != 0
                for (column_name, column_value) in row.items()
            )
            for row in flattened_data
        )
        return has_data

    def get(self, request: Request, organization: Organization) -> Response:
        query_source = self.get_request_source(request)

        with sentry_sdk.start_span(op="discover.endpoint", name="filter_params") as span:
            span.set_data("organization", organization)

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
            use_metrics = (
                batch_features.get("organizations:performance-use-metrics", False)
                or batch_features.get("organizations:dashboards-mep", False)
                or (
                    batch_features.get("organizations:mep-rollout-flag", False)
                    and features.has(
                        "organizations:dynamic-sampling",
                        organization=organization,
                        actor=request.user,
                    )
                )
            )

            dataset = self.get_dataset(request)
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
                        spans_indexed,
                        spans_metrics,
                        Spans,
                        OurLogs,
                        PreprodSize,
                        ProfileFunctions,
                        TraceMetrics,
                        errors,
                        transactions,
                    ]
                    else discover
                )

            metrics_enhanced = dataset in {metrics_performance, metrics_enhanced_performance}

            allow_metric_aggregates = request.GET.get("preventMetricAggregates") != "1"
            sentry_sdk.set_tag("performance.metrics_enhanced", metrics_enhanced)

        try:
            use_on_demand_metrics, on_demand_metrics_type = self.handle_on_demand(request)
        except ValueError:
            metric_type_values = [e.value for e in MetricSpecType]
            metric_types = ",".join(metric_type_values)
            return Response({"detail": f"Metric type must be one of: {metric_types}"}, status=400)

        force_metrics_layer = request.GET.get("forceMetricsLayer") == "true"
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
                    )

                return SearchResolverConfig(
                    auto_fields=False,
                    use_aggregate_conditions=True,
                    disable_aggregate_extrapolation=request.GET.get(
                        "disableAggregateExtrapolation", "0"
                    )
                    == "1",
                    extrapolation_mode=extrapolation_mode,
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
                has_metrics=use_metrics,
                # We want to allow people to force use the new metrics layer in the query builder. We decided to go for
                # this approach so that we can have only a subset of parts of sentry that use the new metrics layer for
                # their queries since right now the metrics layer has not full feature parity with the query builder.
                use_metrics_layer=force_metrics_layer
                or batch_features.get("organizations:use-metrics-layer", False),
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

        def get_event_stats_factory(scoped_dataset):
            """
            This factory closes over dataset in order to make an additional request to the errors dataset
            in the case that this request is from a dashboard widget and we're trying to split their discover dataset.

            This should be removed once the discover dataset is completely split in dashboards.
            """
            dashboard_widget_id = request.GET.get("dashboardWidgetId", None)

            def fn(
                query_columns: list[str],
                query: str,
                snuba_params: SnubaParams,
                rollup: int,
                zerofill_results: bool,
                comparison_delta: timedelta | None,
            ) -> SnubaTSResult | dict[str, SnubaTSResult]:

                if not (metrics_enhanced and dashboard_widget_id):
                    return _get_event_stats(
                        scoped_dataset,
                        query_columns,
                        query,
                        snuba_params,
                        rollup,
                        zerofill_results,
                        comparison_delta,
                    )

                try:
                    widget = DashboardWidget.objects.get(
                        id=dashboard_widget_id, dashboard__organization_id=organization.id
                    )
                    does_widget_have_split = widget.discover_widget_split is not None

                    if does_widget_have_split:
                        # This is essentially cached behaviour and we skip the check
                        split_query = query
                        if widget.discover_widget_split == DashboardWidgetTypes.ERROR_EVENTS:
                            split_dataset = discover
                            split_query = f"({query}) AND !event.type:transaction"
                        elif widget.discover_widget_split == DashboardWidgetTypes.TRANSACTION_LIKE:
                            # We can't add event.type:transaction for now because of on-demand.
                            split_dataset = scoped_dataset
                        else:
                            # This is a fallback for the ambiguous case.
                            split_dataset = discover

                        return _get_event_stats(
                            split_dataset,
                            query_columns,
                            split_query,
                            snuba_params,
                            rollup,
                            zerofill_results,
                            comparison_delta,
                        )

                    # Widget has not split the discover dataset yet, so we need to check if there are errors etc.
                    errors_only_query = f"({query}) AND !event.type:transaction"
                    error_results = None
                    try:
                        error_results = _get_event_stats(
                            discover,
                            query_columns,
                            errors_only_query,
                            snuba_params,
                            rollup,
                            zerofill_results,
                            comparison_delta,
                        )
                        has_errors = self.check_if_results_have_data(error_results)
                    except SnubaError:
                        has_errors = False

                    original_results = _get_event_stats(
                        scoped_dataset,
                        query_columns,
                        query,
                        snuba_params,
                        rollup,
                        zerofill_results,
                        comparison_delta,
                    )
                    has_other_data = self.check_if_results_have_data(original_results)
                    if isinstance(original_results, SnubaTSResult):
                        dataset_meta = original_results.data.get("meta", {})
                    else:
                        if len(original_results) > 0:
                            dataset_meta = list(original_results.values())[0].data.get("meta", {})
                        else:
                            dataset_meta = {}

                    using_metrics = dataset_meta.get("isMetricsData", False) or dataset_meta.get(
                        "isMetricsExtractedData", False
                    )

                    has_transactions = has_other_data
                    transaction_results = None
                    if has_errors and has_other_data and not using_metrics:
                        # In the case that the original request was not using the metrics dataset, we cannot be certain that other data is solely transactions.
                        sentry_sdk.set_tag("third_split_query", True)
                        transactions_only_query = f"({query}) AND event.type:transaction"
                        transaction_results = _get_event_stats(
                            discover,
                            query_columns,
                            transactions_only_query,
                            snuba_params,
                            rollup,
                            zerofill_results,
                            comparison_delta,
                        )
                        has_transactions = self.check_if_results_have_data(transaction_results)

                    decision = self.save_split_decision(
                        widget, has_errors, has_transactions, organization, request.user
                    )

                    if decision == DashboardWidgetTypes.DISCOVER:
                        # The user needs to be warned to split in this case.
                        return _get_event_stats(
                            discover,
                            query_columns,
                            query,
                            snuba_params,
                            rollup,
                            zerofill_results,
                            comparison_delta,
                        )
                    elif decision == DashboardWidgetTypes.TRANSACTION_LIKE:
                        for result in (
                            original_results.values()
                            if isinstance(original_results, dict)
                            else [original_results]
                        ):
                            if not result.data.get("meta"):
                                result.data["meta"] = {}
                            result.data["meta"]["discoverSplitDecision"] = (
                                DashboardWidgetTypes.get_type_name(
                                    DashboardWidgetTypes.TRANSACTION_LIKE
                                )
                            )
                        return original_results
                    elif decision == DashboardWidgetTypes.ERROR_EVENTS and error_results:
                        for result in (
                            error_results.values()
                            if isinstance(error_results, dict)
                            else [error_results]
                        ):
                            if not result.data.get("meta"):
                                result.data["meta"] = {}
                            result.data["meta"]["discoverSplitDecision"] = (
                                DashboardWidgetTypes.get_type_name(
                                    DashboardWidgetTypes.ERROR_EVENTS
                                )
                            )
                        return error_results
                    else:
                        return original_results

                except Exception as e:
                    # Swallow the exception if it was due to discover split, and try again one more time.
                    sentry_sdk.capture_exception(e)
                    return _get_event_stats(
                        scoped_dataset,
                        query_columns,
                        query,
                        snuba_params,
                        rollup,
                        zerofill_results,
                        comparison_delta,
                    )

            return fn

        get_event_stats = get_event_stats_factory(dataset)
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
