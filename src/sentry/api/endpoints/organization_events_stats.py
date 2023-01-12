from datetime import datetime, timedelta
from typing import Dict, Mapping, Optional, Sequence, Set

import sentry_sdk
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEventsV2EndpointBase
from sentry.constants import MAX_TOP_EVENTS
from sentry.models import Organization
from sentry.snuba import discover, metrics_enhanced_performance, metrics_performance
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import SnubaTSResult

METRICS_ENHANCED_REFERRERS: Set[str] = {
    Referrer.API_PERFORMANCE_HOMEPAGE_WIDGET_CHART.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_DURATION_HISTOGRAM.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_LCP_HISTOGRAM.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_FCP_HISTOGRAM.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_FID_HISTOGRAM.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_APDEX_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_P50_DURATION_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_P75_DURATION_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_P95_DURATION_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_P99_DURATION_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_P75_LCP_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_TPM_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_FAILURE_RATE_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_USER_MISERY_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_LCP_VITALS.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_FCP_VITALS.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_CLS_VITALS.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_FID_VITALS.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_IMRPOVED.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_REGRESSED.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_RELATED_ERRORS.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_RELATED_ISSUES.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_HTTP_OPS.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_DB_OPS.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_RESOURCE_OPS.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_BROWSER_OPS.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_COLD_STARTUP_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_WARM_STARTUP_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_FRAMES_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_FROZEN_FRAMES_AREA.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_SLOW_FRAMES.value,
    Referrer.API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_FROZEN_FRAMES.value,
}


ALLOWED_EVENTS_STATS_REFERRERS: Set[str] = {
    Referrer.API_ALERTS_ALERT_RULE_CHART.value,
    Referrer.API_DASHBOARDS_WIDGET_AREA_CHART.value,
    Referrer.API_DASHBOARDS_WIDGET_BAR_CHART.value,
    Referrer.API_DASHBOARDS_WIDGET_LINE_CHART.value,
    Referrer.API_DASHBOARDS_TOP_EVENTS.value,
    Referrer.API_DISCOVER_PREBUILT_CHART.value,
    Referrer.API_DISCOVER_PREVIOUS_CHART.value,
    Referrer.API_DISCOVER_DEFAULT_CHART.value,
    Referrer.API_DISCOVER_DAILY_CHART.value,
    Referrer.API_DISCOVER_TOP5_CHART.value,
    Referrer.API_DISCOVER_DAILYTOP5_CHART.value,
    Referrer.API_PERFORMANCE_HOMEPAGE_DURATION_CHART.value,
    Referrer.API_PERFORMANCE_HOMEPAGE_WIDGET_CHART.value,
    Referrer.API_PERFORMANCE_TRANSACTION_SUMMARY_SIDEBAR_CHART.value,
    Referrer.API_PERFORMANCE_TRANSACTION_SUMMARY_VITALS_CHART.value,
    Referrer.API_PERFORMANCE_TRANSACTION_SUMMARY_TRENDS_CHART.value,
    Referrer.API_PERFORMANCE_TRANSACTION_SUMMARY_DURATION.value,
    Referrer.API_PROFILING_LANDING_CHART.value,
    Referrer.API_RELEASES_RELEASE_DETAILS_CHART.value,
}


@region_silo_endpoint
class OrganizationEventsStatsEndpoint(OrganizationEventsV2EndpointBase):  # type: ignore
    def get_features(self, organization: Organization, request: Request) -> Mapping[str, bool]:
        feature_names = [
            "organizations:performance-chart-interpolation",
            "organizations:performance-use-metrics",
            "organizations:dashboards-mep",
            "organizations:mep-rollout-flag",
            "organizations:use-metrics-layer",
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

    def get(self, request: Request, organization: Organization) -> Response:
        with sentry_sdk.start_span(op="discover.endpoint", description="filter_params") as span:
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
                    return Response({"detail": "If topEvents needs to be at least 1"}, status=400)

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
            referrer = (
                referrer
                if referrer in ALLOWED_EVENTS_STATS_REFERRERS.union(METRICS_ENHANCED_REFERRERS)
                else Referrer.API_ORGANIZATION_EVENT_STATS.value
            )
            batch_features = self.get_features(organization, request)
            has_chart_interpolation = batch_features.get(
                "organizations:performance-chart-interpolation", False
            )
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

            use_profiles = features.has(
                "organizations:profiling",
                organization=organization,
                actor=request.user,
            )

            use_metrics_layer = batch_features.get("organizations:use-metrics-layer", False)

            use_custom_dataset = use_metrics or use_profiles
            dataset = self.get_dataset(request) if use_custom_dataset else discover
            metrics_enhanced = dataset in {metrics_performance, metrics_enhanced_performance}

            allow_metric_aggregates = request.GET.get("preventMetricAggregates") != "1"
            sentry_sdk.set_tag("performance.metrics_enhanced", metrics_enhanced)

        def get_event_stats(
            query_columns: Sequence[str],
            query: str,
            params: Dict[str, str],
            rollup: int,
            zerofill_results: bool,
            comparison_delta: Optional[datetime],
        ) -> SnubaTSResult:
            if top_events > 0:
                return discover.top_events_timeseries(
                    timeseries_columns=query_columns,
                    selected_columns=self.get_field_list(organization, request),
                    equations=self.get_equation_list(organization, request),
                    user_query=query,
                    params=params,
                    orderby=self.get_orderby(request),
                    rollup=rollup,
                    limit=top_events,
                    organization=organization,
                    referrer=referrer + ".find-topn",
                    allow_empty=False,
                    zerofill_results=zerofill_results,
                    include_other=include_other,
                )
            return dataset.timeseries_query(
                selected_columns=query_columns,
                query=query,
                params=params,
                rollup=rollup,
                referrer=referrer,
                zerofill_results=zerofill_results,
                comparison_delta=comparison_delta,
                allow_metric_aggregates=allow_metric_aggregates,
                has_metrics=use_metrics,
                use_metrics_layer=use_metrics_layer,
            )

        try:
            return Response(
                self.get_event_stats_data(
                    request,
                    organization,
                    get_event_stats,
                    top_events,
                    allow_partial_buckets=allow_partial_buckets,
                    zerofill_results=not (
                        request.GET.get("withoutZerofill") == "1" and has_chart_interpolation
                    ),
                    comparison_delta=comparison_delta,
                ),
                status=200,
            )
        except ValidationError:
            return Response({"detail": "Comparison period is outside retention window"}, status=400)
