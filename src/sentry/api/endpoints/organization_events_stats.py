from __future__ import absolute_import

import six

from datetime import timedelta
from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry import features
from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.api.event_search import resolve_field_list, InvalidSearchQuery
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.utils.dates import parse_stats_period
from sentry.utils import snuba


class OrganizationEventsStatsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        try:
            if features.has("organizations:events-v2", organization, actor=request.user):
                params = self.get_filter_params(request, organization)
                snuba_args = self.get_snuba_query_args(request, organization, params)
            else:
                snuba_args = self.get_snuba_query_args_legacy(request, organization)
        except (OrganizationEventsError, InvalidSearchQuery) as exc:
            raise ParseError(detail=six.text_type(exc))
        except NoProjects:
            return Response({"data": []})

        interval = parse_stats_period(request.GET.get("interval", "1h"))
        if interval is None:
            interval = timedelta(hours=1)
        rollup = int(interval.total_seconds())

        snuba_args = self.get_field(request, snuba_args)

        result = snuba.transform_aliases_and_query(
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

        try:
            resolved = resolve_field_list([y_axis], {})
        except InvalidSearchQuery as err:
            raise ParseError(detail=six.text_type(err))
        aggregate = resolved["aggregations"][0]
        aggregate[2] = "count"
        snuba_args["aggregations"] = [aggregate]

        return snuba_args
