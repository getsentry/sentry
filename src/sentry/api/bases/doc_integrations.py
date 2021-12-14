from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.api.permissions import SentryPermission
from sentry.api.validators.doc_integration import METADATA_TYPES
from sentry.auth.superuser import is_active_superuser
from sentry.utils.json import JSONData


class DocIntegrationsPermission(SentryPermission):
    def has_permission(self, request: Request, view: Endpoint):
        if not hasattr(request, "user") or not request.user:
            return False

        if is_active_superuser(request) or request.method == "GET":
            return True

        return False


class DocIntegrationsBaseEndpoint(Endpoint):
    permission_classes = (DocIntegrationsPermission,)

    def generate_incoming_metadata(self, request: Request) -> JSONData:
        metadata_payload = {}
        for metadata_type in METADATA_TYPES:
            metadata_payload[metadata_type] = request.json_body.get(metadata_type, [])
        return metadata_payload
