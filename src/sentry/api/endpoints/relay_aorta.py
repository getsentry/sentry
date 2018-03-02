from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.authentication import RelayAuthentication
from sentry.api.permissions import RelayPermission
from sentry.relay import query


class RelayAortaEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication, )
    permission_classes = (RelayPermission, )

    def post(self, request):
        # TODO(mitsuhiko): add support for changesets
        queries = request.relay_request_data.get('queries')
        if queries:
            query_response = query.execute_queries(request.relay, queries)
        return Response({
            'queryResults': query_response,
        }, status=200)
