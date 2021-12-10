from rest_framework.request import Request

from sentry.api.bases.sentryapps import IntegrationPlatformEndpoint, ensure_scoped_permission
from sentry.api.permissions import SentryPermission
from sentry.api.validators.doc_integration import METADATA_TYPES
from sentry.auth.superuser import is_active_superuser
from sentry.models.integration import DocIntegration
from sentry.utils.json import JSONData


class DocIntegrationsPermission(SentryPermission):
    scope_map = {
        # GET is ideally a public endpoint but for now we are allowing for
        # anyone who has member permissions or above.
        "GET": (
            "event:read",
            "event:write",
            "event:admin",
            "project:releases",
            "project:read",
            "org:read",
            "member:read",
            "team:read",
        ),
        "POST": (
            "event:read",
            "event:write",
            "event:admin",
            "project:releases",
            "project:read",
            "org:read",
            "member:read",
            "team:read",
        ),
    }

    def has_object_permission(self, request: Request, view, doc_integration: DocIntegration):
        if not hasattr(request, "user") or not request.user:
            return False

        if is_active_superuser(request):
            return True

        return ensure_scoped_permission(request, self.scope_map.get(request.method))


class DocIntegrationsBaseEndpoint(IntegrationPlatformEndpoint):
    permission_classes = (DocIntegrationsPermission,)

    def generate_metadata(self, request: Request) -> JSONData:
        metadata_payload = {}
        for metadata_type in METADATA_TYPES:
            metadata_payload[metadata_type] = request.json_body.get(metadata_type)
        return metadata_payload
