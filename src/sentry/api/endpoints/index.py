from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint


class IndexEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request):
        context = {
            'version': '0',
        }
        return Response(context, status=200)
