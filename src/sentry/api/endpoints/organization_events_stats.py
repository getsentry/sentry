import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.event_search import InvalidSearchQuery, resolve_field_list
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.constants import MAX_TOP_EVENTS
from sentry.discover.utils import transform_aliases_and_query
from sentry.snuba import discover
from sentry.utils import snuba
from sentry.utils.dates import get_rollup_from_request


class OrganizationEventsStatsEndpoint(OrganizationEventsV2EndpointBase):
    def get(self, request, organization):
        with sentry_sdk.start_span(op="discover.endpoint", description="filter_params") as span:
            span.set_data("organization", organization)
            if not self.has_feature(organization, request):
                span.set_data("using_v1_results", True)
                return self.get_v1_results(request, organization)

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
                    selected_columns=request.GET.getlist("field")[:],
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

    def get_v1_results(self, request, organization):
        try:
            snuba_args = self.get_snuba_query_args_legacy(request, organization)
        except InvalidSearchQuery as exc:
            raise ParseError(detail=str(exc))
        except NoProjects:
            return Response({"data": []})

        snuba_args = self.get_field(request, snuba_args)
        rollup = get_rollup_from_request(
            request,
            snuba_args,
            "1h",
            InvalidSearchQuery(
                "Your interval and date range would create too many results. "
                "Use a larger interval, or a smaller date range."
            ),
        )

        result = transform_aliases_and_query(
            aggregations=snuba_args.get("aggregations"),
            conditions=snuba_args.get("conditions"),
            filter_keys=snuba_args.get("filter_keys"),
            start=snuba_args.get("start"),
            end=snuba_args.get("end"),
            orderby="time",
            groupby=["time"],
            rollup=rollup,
            referrer="api.organization-events-stats",
            limit=10000,
        )
        serializer = SnubaTSResultSerializer(organization, None, request.user)
        return Response(
            serializer.serialize(
                snuba.SnubaTSResult(result, snuba_args["start"], snuba_args["end"], rollup)
            ),
            status=200,
        )

    def get_field(self, request, snuba_args):
        y_axis = request.GET.get("yAxis", None)
        # These aliases are used by v1 of events.
        if not y_axis or y_axis == "event_count":
            y_axis = "count()"
        elif y_axis == "user_count":
            y_axis = "count_unique(user)"

        snuba_filter = eventstore.Filter(
            {
                "start": snuba_args.get("start"),
                "end": snuba_args.get("end"),
                "rollup": snuba_args.get("rollup"),
            }
        )
        try:
            resolved = resolve_field_list([y_axis], snuba_filter)
        except InvalidSearchQuery as err:
            raise ParseError(detail=str(err))
        try:
            aggregate = resolved["aggregations"][0]
        except IndexError:
            raise ParseError(detail="Invalid yAxis value requested.")
        aggregate[2] = "count"
        snuba_args["aggregations"] = [aggregate]

        return snuba_args
