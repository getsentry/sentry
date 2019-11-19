from __future__ import absolute_import

import six

from datetime import timedelta
from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry import features
from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.api.event_search import resolve_field_list, InvalidSearchQuery
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.cache import default_cache
from sentry.utils.dates import parse_stats_period
from sentry.utils import snuba, json


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

        cache_key = cache_key_for_snuba_args(organization, params, snuba_args)

        snuba_data = default_cache.get(cache_key)

        import logging

        if snuba_data is not None:
            logging.info("foo cache: %s", cache_key)
            return Response(snuba_data, status=200)

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

        snuba_data = serializer.serialize(
            snuba.SnubaTSResult(result, snuba_args["start"], snuba_args["end"], rollup)
        )

        cache_timeout = 900  # 15 minutes = 900 seconds
        default_cache.set(cache_key, snuba_data, cache_timeout)
        logging.info("foo cache miss: %s", cache_key)

        return Response(snuba_data, status=200)

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
        try:
            aggregate = resolved["aggregations"][0]
        except IndexError:
            raise ParseError(detail="Invalid yAxis value requested.")
        aggregate[2] = "count"
        snuba_args["aggregations"] = [aggregate]

        return snuba_args


def cache_key_for_snuba_args(organization, params, snuba_args):

    lol = json.dumps(
        [
            snuba_args.get("aggregations"),
            snuba_args.get("conditions"),
            snuba_args.get("filter_keys"),
            params,
        ]
    )

    import logging

    logging.info("payload: %s", lol)

    hash_result = hash(lol)

    hash_rrr = u"e:{org_slug}:{hash}".format(
        org_slug=organization.slug, hash=six.binary_type(hash_result)
    )

    logging.info("hash_rrr: %s", hash_rrr)

    return hash_rrr
