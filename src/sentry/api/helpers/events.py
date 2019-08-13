from __future__ import absolute_import

from rest_framework.response import Response

from sentry import eventstore
from sentry.api.event_search import get_snuba_query_args
from sentry.utils.validators import normalize_event_id
from sentry.api.serializers import serialize


def get_direct_hit_response(request, query, snuba_params, referrer):
    """
    Checks whether a query is a direct hit for an event, and if so returns
    a response. Otherwise returns None
    """
    event_id = normalize_event_id(query)
    if event_id:
        snuba_args = get_snuba_query_args(
            query=u'id:{}'.format(event_id),
            params=snuba_params)

        results = eventstore.get_events(
            referrer=referrer,
            **snuba_args
        )

        if len(results) == 1:
            response = Response(serialize(results, request.user))
            response['X-Sentry-Direct-Hit'] = '1'
            return response
