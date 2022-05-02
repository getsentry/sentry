from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import Endpoint


class AuditLogAPINamesEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        # list of the audit log api names
        audit_log_api_names = audit_log.get_api_names()
        return Response(audit_log_api_names)
