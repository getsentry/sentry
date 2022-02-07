from typing import Sequence

from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint


class RelayHealthCheck(Endpoint):  # type: ignore
    """
    Endpoint checked by downstream Relay when a suspected network error is encountered.
    This endpoint doesn't do anything besides returning an Ok, and the downstream Relay
    only checks that the response returns, i.e. the server is reachable.

    It is implemented exactly the same here (in sentry) and in Relay so that the downstream
    Relay doesn't need to care if it connects to another Relay or directly to sentry.
    """

    authentication_classes: Sequence[BaseAuthentication] = ()
    permission_classes: Sequence[BasePermission] = ()

    def get(self, request: Request) -> Response:
        return Response({"is_healthy": True}, status=200)
