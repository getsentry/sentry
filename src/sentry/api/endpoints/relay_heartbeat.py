from __future__ import absolute_import

from rest_framework.response import Response

from datetime import timedelta
from django.utils import timezone

from sentry.api.base import Endpoint
from sentry.relay import change_set, query
from sentry.api.permissions import RelayPermission
from sentry.api.authentication import RelayAuthentication


class RelayHeartbeatEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication, )
    permission_classes = (RelayPermission, )

    def post(self, request):
        now = timezone.now()
        if now >= request.relay.last_seen + timedelta(minutes=1):
            request.relay.update(last_seen=now)

        changesets = request.relay_request_data.get('changesets')
        if changesets:
            change_set.execute_changesets(request.relay, changesets)

        queries = request.relay_request_data.get('queries')
        if queries:
            query_response = query.execute_queries(request.relay, queries)
        else:
            query_response = {}

        return Response({
            'queryResults': query_response,
        }, status=200)
