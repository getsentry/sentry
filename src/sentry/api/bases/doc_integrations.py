from __future__ import annotations

from django.http import Http404
from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.api.bases.integration import PARANOID_GET
from sentry.api.permissions import SentryPermission, StaffPermissionMixin
from sentry.api.validators.doc_integration import METADATA_PROPERTIES
from sentry.auth.superuser import is_active_superuser
from sentry.models.integrations.doc_integration import DocIntegration
from sentry.utils.json import JSONData
from sentry.utils.sdk import configure_scope


class DocIntegrationsPermission(SentryPermission):
    scope_map = {"GET": PARANOID_GET}

    def has_permission(self, request: Request, view: object) -> bool:
        """
        We only want non-sentry employees to be able to access GET. PUT + DEL
        should only be accessible through _admin.
        """
        if not super().has_permission(request, view):
            return False

        # TODO(schew2381): Remove superuser check once staff feature flag is rolled out
        # We want to limit POST + DEL to staff only through the mixin
        if is_active_superuser(request) or request.method == "GET":
            return True

        return False

    def has_object_permission(
        self, request: Request, view: object, doc_integration: DocIntegration
    ) -> bool:
        """
        We only want non-sentry employees to be able to access GET, and only for
        published integrations. PUT + DEL should only be accessible through _admin.
        """
        if not hasattr(request, "user") or not request.user:
            return False

        # TODO(schew2381): Remove superuser check once staff feature flag is rolled out
        # We want to limit POST + DEL to staff only through the mixin
        if is_active_superuser(request):
            return True

        if not doc_integration.is_draft and request.method == "GET":
            return True

        return False


class DocIntegrationsAndStaffPermission(StaffPermissionMixin, DocIntegrationsPermission):
    pass


class DocIntegrationsBaseEndpoint(Endpoint):
    """
    Base endpoint used for doc integration collection endpoints.
    """

    permission_classes = (DocIntegrationsAndStaffPermission,)

    def generate_incoming_metadata(self, request: Request) -> JSONData:
        return {k: v for k, v in request.json_body.items() if k in METADATA_PROPERTIES}


class DocIntegrationBaseEndpoint(DocIntegrationsBaseEndpoint):
    """
    Base endpoint used for doc integration item endpoints.
    """

    def convert_args(self, request: Request, doc_integration_slug: str, *args, **kwargs):
        try:
            doc_integration = DocIntegration.objects.get(slug=doc_integration_slug)
        except DocIntegration.DoesNotExist:
            raise Http404

        self.check_object_permissions(request, doc_integration)

        with configure_scope() as scope:
            scope.set_tag("doc_integration", doc_integration.slug)

        kwargs["doc_integration"] = doc_integration
        return (args, kwargs)
