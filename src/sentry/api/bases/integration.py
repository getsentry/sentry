import sys
import traceback

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils.sdk import capture_exception

from .organization import OrganizationEndpoint, OrganizationPermission

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


class IntegrationEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission,)

    def handle_exception(self, request: Request, exc) -> Response:
        if hasattr(exc, "code") and exc.code == 503:
            sys.stderr.write(traceback.format_exc())
            event_id = capture_exception()
            context = {"detail": str(exc), "errorId": event_id}
            response = Response(context, status=503)
            response.exception = True
            return response
        return super().handle_exception(request, exc)
