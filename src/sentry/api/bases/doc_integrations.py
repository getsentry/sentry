from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.api.bases.integration import PARANOID_GET
from sentry.api.permissions import SentryPermission
from sentry.api.validators.doc_integration import METADATA_PROPERTIES
from sentry.auth.superuser import is_active_superuser
from sentry.utils.json import JSONData


class DocIntegrationsPermission(SentryPermission):
    scope_map = {"GET": PARANOID_GET}

    def has_permission(self, request: Request, view: Endpoint):
        if not super().has_permission(request, view):
            return False

        if is_active_superuser(request) or request.method == "GET":
            return True

        return False


class DocIntegrationsBaseEndpoint(Endpoint):
    permission_classes = (DocIntegrationsPermission,)

    def generate_incoming_metadata(self, request: Request) -> JSONData:
        return {k: v for k, v in request.json_body.items() if k in METADATA_PROPERTIES}
