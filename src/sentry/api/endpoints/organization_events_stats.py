import sentry_sdk
from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsV2EndpointBase
from sentry.constants import MAX_TOP_EVENTS
from sentry.snuba import discover


class OrganizationEventsStatsEndpoint(OrganizationEventsV2EndpointBase):
    def get(self, request, organization):
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

            # The partial parameter determins whether or not partial buckets are allowed.
            # The last bucket of the time series can potentially be a partial bucket when
            # the start of the bucket does not align with the rollup.
            allow_partial_buckets = request.GET.get("partial") == "1"

        def get_event_stats(query_columns, query, params, rollup):
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
                    referrer="api.organization-event-stats.find-topn",
                    allow_empty=False,
                )
            return discover.timeseries_query(
                selected_columns=query_columns,
                query=query,
                params=params,
                rollup=rollup,
                referrer="api.organization-event-stats",
            )

        return Response(
            self.get_event_stats_data(
                request,
                organization,
                get_event_stats,
                top_events,
                allow_partial_buckets=allow_partial_buckets,
            ),
            status=200,
        )
