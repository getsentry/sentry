from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, control_silo_endpoint


@control_silo_endpoint
class InternalProxyEndpoint(Endpoint):
    authentication_classes = []
    permission_classes = []

    def get(self, request: Request) -> Response:
        return Response({"is_proxied": False}, status=200)
