from __future__ import annotations

from typing import Any

from django.http import Http404
from rest_framework.request import Request
from rest_framework.views import APIView

from sentry.api.base import Endpoint
from sentry.api.permissions import SentryPermission, staff_permission_cls
from sentry.auth.superuser import is_active_superuser
from sentry.integrations.api.bases.integration import PARANOID_GET
from sentry.integrations.api.parsers.doc_integration import METADATA_PROPERTIES
from sentry.integrations.models.doc_integration import DocIntegration
from sentry.utils.sdk import Scope


class DocIntegrationsPermission(SentryPermission):
    """
    Allows all org members to access GET as long as they have the necessary
    scopes. For item endpoints, the doc integration must be published.

    # TODO(schew2381): Remove superuser language once staff feature flag is rolled out
    Superusers can access unpublished doc integrations (GET) and also use PUT + DEL
    which endpoints which are all accessible through _admin.
    """

    scope_map = {"GET": PARANOID_GET}

    def has_permission(self, request: Request, view: APIView) -> bool:
        if not super().has_permission(request, view):
            return False

        # TODO(schew2381): Remove superuser check once staff feature flag is rolled out.
        # We want to allow staff through the staff_permission_cls instead of mixing logic here.
        if is_active_superuser(request) or request.method == "GET":
            return True

        return False

    def has_object_permission(
        self, request: Request, view: APIView, doc_integration: DocIntegration
    ) -> bool:
        if not hasattr(request, "user") or not request.user:
            return False

        # TODO(schew2381): Remove superuser check once staff feature flag is rolled out.
        # We want to allow staff through the staff_permission_cls instead of mixing logic here.
        if is_active_superuser(request):
            return True

        if not doc_integration.is_draft and request.method == "GET":
            return True

        return False


DocIntegrationsAndStaffPermission = staff_permission_cls(
    "DocIntegrationsAndStaffPermission", DocIntegrationsPermission
)


class DocIntegrationsBaseEndpoint(Endpoint):
    """
    Base endpoint used for doc integration collection endpoints.
    """

    permission_classes = (DocIntegrationsAndStaffPermission,)

    def generate_incoming_metadata(self, request: Request) -> Any:
        return {k: v for k, v in request.data.items() if k in METADATA_PROPERTIES}


class DocIntegrationBaseEndpoint(DocIntegrationsBaseEndpoint):
    """
    Base endpoint used for doc integration item endpoints.
    """

    def convert_args(
        self, request: Request, doc_integration_id_or_slug: int | str, *args, **kwargs
    ):
        try:
            doc_integration = DocIntegration.objects.get(
                slug__id_or_slug=doc_integration_id_or_slug
            )
        except DocIntegration.DoesNotExist:
            raise Http404

        self.check_object_permissions(request, doc_integration)

        Scope.get_isolation_scope().set_tag("doc_integration", doc_integration.slug)

        kwargs["doc_integration"] = doc_integration
        return (args, kwargs)
