from __future__ import absolute_import

from rest_framework.response import Response
from sentry.api.base import Endpoint


class DataExportEndpoint(Endpoint):
    def get():
        return Response(data="THIS IS WORKING")
