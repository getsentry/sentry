from __future__ import absolute_import

from rest_framework.response import Response
# from sentry.api.base import Endpoint
from rest_framework.compat import View


class BlankEndpoint(View):

    def get(self, request):
        return Response({'hello': 'world'}, status=200)
