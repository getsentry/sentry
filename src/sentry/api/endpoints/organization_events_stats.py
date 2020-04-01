from __future__ import absolute_import

import six

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry import features, eventstore
from sentry.api.bases import OrganizationEventsV2EndpointBase, OrganizationEventsError, NoProjects
from sentry.api.event_search import resolve_field_list, InvalidSearchQuery
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.discover.utils import transform_aliases_and_query
from sentry.snuba import discover
from sentry.utils import snuba
from sentry.utils.dates import get_rollup_from_request


class OrganizationEventsStatsEndpoint(OrganizationEventsV2EndpointBase):
    def get(self, request, organization):
        if not features.has("organizations:discover-basic", organization, actor=request.user):
            return self.get_v1_results(request, organization)

        def get_event_stats(query_columns, query, params, rollup, reference_event):
            return discover.timeseries_query(
                selected_columns=query_columns,
                query=query,
                params=params,
                rollup=rollup,
                reference_event=reference_event,
                referrer="api.organization-event-stats",
            )

        return Response(
            self.get_event_stats_data(request, organization, get_event_stats), status=200
        )

    def get_v1_results(self, request, organization):
        try:
            snuba_args = self.get_snuba_query_args_legacy(request, organization)
        except (OrganizationEventsError, InvalidSearchQuery) as exc:
            raise ParseError(detail=six.text_type(exc))
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
            raise ParseError(detail=six.text_type(err))
        try:
            aggregate = resolved["aggregations"][0]
        except IndexError:
            raise ParseError(detail="Invalid yAxis value requested.")
        aggregate[2] = "count"
        snuba_args["aggregations"] = [aggregate]

        return snuba_args
