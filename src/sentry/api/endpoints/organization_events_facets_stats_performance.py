from datetime import datetime, timedelta
from typing import Dict, Optional, Sequence

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.endpoints.organization_events_facets_performance import (
    OrganizationEventsFacetsPerformanceEndpointBase,
    query_facet_performance,
    query_tag_data,
)
from sentry.snuba.discover import top_events_timeseries
from sentry.snuba.referrer import Referrer

ALLOWED_AGGREGATE_COLUMNS = {
    "transaction.duration",
    "measurements.lcp",
    "spans.browser",
    "spans.http",
    "spans.db",
    "spans.resource",
}

TAG_ALIASES = {"release": "sentry:release", "dist": "sentry:dist", "user": "sentry:user"}
DEFAULT_TAG_KEY_LIMIT = 5
ONE_DAY = int(timedelta(hours=6).total_seconds())


@region_silo_endpoint
class OrganizationEventsFacetsStatsPerformanceEndpoint(
    OrganizationEventsFacetsPerformanceEndpointBase
):
    def get(self, request: Request, organization) -> Response:
        try:
            params, aggregate_column, filter_query = self._setup(request, organization)
        except NoProjects:
            return Response([])

        all_tag_keys = None
        tag_key = None

        all_tag_keys = request.GET.get("allTagKeys")
        tag_key = request.GET.get("tagKey")

        if tag_key in TAG_ALIASES:
            tag_key = TAG_ALIASES.get(tag_key)

        with sentry_sdk.start_span(op="discover.endpoint", description="discover_query"):
            referrer = Referrer.API_PERFORMANCE_EVENTS_FACETS_STATS.value
            tag_data = query_tag_data(
                filter_query=filter_query,
                aggregate_column=aggregate_column,
                referrer=referrer,
                params=params,
            )

            if not tag_data:
                return {"data": []}

            top_facets = query_facet_performance(
                tag_data=tag_data,
                filter_query=filter_query,
                aggregate_column=aggregate_column,
                referrer=referrer,
                orderby=self.get_orderby(request),
                limit=5,
                params=params,
                all_tag_keys=all_tag_keys,
                tag_key=tag_key,
                include_count_delta=True,
            )

            if not top_facets:
                return {"data": []}

            def get_event_stats(
                query_columns: Sequence[str],
                query: str,
                params: Dict[str, str],
                rollup: int,
                zerofill_results: bool,
                comparison_delta: Optional[datetime],
            ):
                return top_events_timeseries(
                    timeseries_columns=query_columns,
                    selected_columns=["tags_key", "tags_value"],
                    top_events=top_facets,
                    user_query=query,
                    params=params,
                    orderby=["tags_key", "tags_value"],
                    # TODO: Better selection of granularity,
                    # but we generally only need pretty low granularity
                    # for this since it's only being used for sparklines
                    rollup=ONE_DAY,
                    limit=10000,
                    organization=None,
                    referrer=referrer,
                )

        results = self.get_event_stats_data(
            request,
            organization,
            get_event_stats,
            top_events=5,
            query=filter_query,
            query_column="count()",
            additional_query_column="p75(transaction.duration)",
        )

        totals = {}
        for facet in top_facets["data"]:
            key = facet.pop("tags_key")
            value = facet.pop("tags_value")
            totals[f"{key},{value}"] = facet

        results["totals"] = totals

        return Response(
            results,
            status=200,
        )
