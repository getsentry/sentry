from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint


class CatchallEndpoint(Endpoint):
    def get(self, request):
        return Response(status=404)

    post = get
    put = get
    delete = get
    patch = get
    options = get
    head = get
