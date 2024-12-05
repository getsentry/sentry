from __future__ import annotations

import sys
import traceback
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrganizationEndpoint
from sentry.utils.sdk import capture_exception

# This GET scope map is ideally a public endpoint but for now
# we are allowing for anyone who has member permissions or above.
PARANOID_GET = (
    "event:read",
    "event:write",
    "event:admin",
    "project:releases",
    "project:read",
    "org:read",
    "member:read",
    "team:read",
)


def _handle_exception(
    exc: Exception,
) -> Response | None:
    if hasattr(exc, "code") and exc.code == 503:
        sys.stderr.write(traceback.format_exc())
        event_id = capture_exception(exc)
        context = {"detail": str(exc), "errorId": event_id}
        response = Response(context, status=503)
        response.exception = True
        return response
    return None


class IntegrationEndpoint(ControlSiloOrganizationEndpoint):
    """
    Baseclass for integration endpoints in control silo that need integration exception handling
    """

    def handle_exception_with_details(
        self,
        request: Request,
        exc: Exception,
        *args: Any,
        **kwds: Any,
    ) -> Response:
        return _handle_exception(exc) or super().handle_exception_with_details(
            request, exc, *args, **kwds
        )


class RegionIntegrationEndpoint(OrganizationEndpoint):
    """
    Baseclass for integration endpoints in region silo that need integration exception handling
    """

    def handle_exception_with_details(
        self,
        request: Request,
        exc: Exception,
        *args: Any,
        **kwds: Any,
    ) -> Response:
        return _handle_exception(exc) or super().handle_exception_with_details(
            request, exc, *args, **kwds
        )
