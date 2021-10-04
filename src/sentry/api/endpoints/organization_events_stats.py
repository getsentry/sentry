from datetime import datetime, timedelta
from typing import Dict, Optional, Sequence, Set

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
    "api.performance.transaction-summary.sidebar-chart",
    "api.performance.transaction-summary.vitals-chart",
    "api.performance.transaction-summary.trends-chart",
    "api.performance.transaction-summary.duration",
    "api.releases.release-details-chart",
}


class OrganizationEventsStatsEndpoint(OrganizationEventsV2EndpointBase):  # type: ignore
    def has_chart_interpolation(self, organization: Organization, request: Request) -> bool:
        return features.has(
            "organizations:performance-chart-interpolation", organization, actor=request.user
        )

    def has_top_events(self, organization: Organization, request: Request) -> bool:
        return features.has("organizations:discover-top-events", organization, actor=request.user)

    def get(self, request: Request, organization: Organization) -> Response:
        with sentry_sdk.start_span(op="discover.endpoint", description="filter_params") as span:
            span.set_data("organization", organization)
            if not self.has_feature(organization, request):
                # We used to return a "v1" result here, keeping tags to keep an eye on its use
                span.set_data("using_v1_results", True)
                sentry_sdk.set_tag("stats.using_v1", organization.slug)
                return Response(status=404)

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
                    include_other=self.has_top_events(organization, request),
                )
            return discover.timeseries_query(
                selected_columns=query_columns,
                query=query,
                params=params,
                rollup=rollup,
                referrer=referrer,
                zerofill_results=zerofill_results,
                comparison_delta=comparison_delta,
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
                        request.GET.get("withoutZerofill") == "1"
                        and self.has_chart_interpolation(organization, request)
                    ),
                    comparison_delta=comparison_delta,
                ),
                status=200,
            )
        except ValidationError:
            return Response({"detail": "Comparison period is outside retention window"}, status=400)
