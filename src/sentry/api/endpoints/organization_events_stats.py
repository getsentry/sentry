from datetime import datetime, timedelta
from typing import Dict, Mapping, Optional, Sequence, Set

import sentry_sdk
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import OrganizationEventsV2EndpointBase
from sentry.constants import MAX_TOP_EVENTS
from sentry.models import Organization
from sentry.snuba import discover
from sentry.utils.snuba import SnubaTSResult

METRICS_ENHANCE_REFERRERS: Set[str] = {
    "api.performance.homepage.widget-chart",
    "api.performance.generic-widget-chart.duration_histogram",
    "api.performance.generic-widget-chart.lcp_histogram",
    "api.performance.generic-widget-chart.fcp_histogram",
    "api.performance.generic-widget-chart.fid_histogram",
    "api.performance.generic-widget-chart.apdex_area",
    "api.performance.generic-widget-chart.p50_duration_area",
    "api.performance.generic-widget-chart.p75_duration_area",
    "api.performance.generic-widget-chart.p95_duration_area",
    "api.performance.generic-widget-chart.p99_duration_area",
    "api.performance.generic-widget-chart.p75_lcp_area",
    "api.performance.generic-widget-chart.tpm_area",
    "api.performance.generic-widget-chart.failure_rate_area",
    "api.performance.generic-widget-chart.user_misery_area",
    "api.performance.generic-widget-chart.worst_lcp_vitals",
    "api.performance.generic-widget-chart.worst_fcp_vitals",
    "api.performance.generic-widget-chart.worst_cls_vitals",
    "api.performance.generic-widget-chart.worst_fid_vitals",
    "api.performance.generic-widget-chart.most_improved",
    "api.performance.generic-widget-chart.most_regressed",
    "api.performance.generic-widget-chart.most_related_errors",
    "api.performance.generic-widget-chart.most_related_issues",
    "api.performance.generic-widget-chart.slow_http_ops",
    "api.performance.generic-widget-chart.slow_db_ops",
    "api.performance.generic-widget-chart.slow_resource_ops",
    "api.performance.generic-widget-chart.slow_browser_ops",
    "api.performance.generic-widget-chart.cold_startup_area",
    "api.performance.generic-widget-chart.warm_startup_area",
    "api.performance.generic-widget-chart.slow_frames_area",
    "api.performance.generic-widget-chart.frozen_frames_area",
    "api.performance.generic-widget-chart.most_slow_frames",
    "api.performance.generic-widget-chart.most_frozen_frames",
}


ALLOWED_EVENTS_STATS_REFERRERS: Set[str] = {
    "api.alerts.alert-rule-chart",
    "api.dashboards.widget.area-chart",
    "api.dashboards.widget.bar-chart",
    "api.dashboards.widget.line-chart",
    "api.dashboards.top-events",
    "api.discover.prebuilt-chart",
    "api.discover.previous-chart",
    "api.discover.default-chart",
    "api.discover.daily-chart",
    "api.discover.top5-chart",
    "api.discover.dailytop5-chart",
    "api.performance.homepage.duration-chart",
    "api.performance.homepage.widget-chart",
    "api.performance.transaction-summary.sidebar-chart",
    "api.performance.transaction-summary.vitals-chart",
    "api.performance.transaction-summary.trends-chart",
    "api.performance.transaction-summary.duration",
    "api.releases.release-details-chart",
}


class OrganizationEventsStatsEndpoint(OrganizationEventsV2EndpointBase):  # type: ignore
    def get_features(self, organization: Organization, request: Request) -> Mapping[str, bool]:
        batch_features = features.batch_has(
            [
                "organizations:performance-chart-interpolation",
                "organizations:discover-use-snql",
                "organizations:performance-use-metrics",
            ],
            organization=organization,
            actor=request.user,
        )
        return batch_features.get(f"organization:{organization.id}", {}) if batch_features else {}

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

            referrer = request.GET.get("referrer")
            referrer = (
                referrer
                if referrer in ALLOWED_EVENTS_STATS_REFERRERS
                else "api.organization-event-stats"
            )
            batch_features = self.get_features(organization, request)
            discover_snql = batch_features.get("organizations:discover-use-snql", False)
            has_chart_interpolation = batch_features.get(
                "organizations:performance-chart-interpolation", False
            )
            performance_use_metrics = batch_features.get(
                "organizations:performance-use-metrics", False
            )

            metrics_enhanced = (
                referrer in METRICS_ENHANCE_REFERRERS
                and performance_use_metrics
                and request.GET.get("metricsEnhanced") == "1"
            )
            sentry_sdk.set_tag("performance.use_metrics", metrics_enhanced)

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
                    include_other=True,
                    use_snql=discover_snql,
                )
            return discover.timeseries_query(
                selected_columns=query_columns,
                query=query,
                params=params,
                rollup=rollup,
                referrer=referrer,
                zerofill_results=zerofill_results,
                comparison_delta=comparison_delta,
                use_snql=discover_snql,
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
