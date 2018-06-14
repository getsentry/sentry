from __future__ import absolute_import

from rest_framework.response import Response

from django.utils import timezone

from sentry.api.base import Endpoint
from sentry.relay import change_set, query
from sentry.api.permissions import RelayPermission
from sentry.api.authentication import RelayAuthentication


class RelayHeartbeatEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication, )
    permission_classes = (RelayPermission, )

    def post(self, request):
        request.relay.last_seen = timezone.now()
        request.relay.save()

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
