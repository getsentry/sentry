from typing import Any

from django.http import HttpRequest, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View

from sentry.organizations.services.organization import organization_service
from sentry.web.frontend.base import OrganizationMixin
from sentry.web.helpers import render_to_response


def get_attr_opt(obj: object | None, name: str) -> Any:
    return getattr(obj, name) if obj else None


class IframeView(View, OrganizationMixin):
    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, organization_slug) -> HttpResponse:
        if request.method != "GET":
            return HttpResponse(status=405)

        org_context = organization_service.get_organization_by_slug(
            slug=organization_slug, only_visible=False
        )
        organization = get_attr_opt(org_context, "organization")

        response = render_to_response("sentry/toolbar/iframe.html")
        response["X-Frame-Options"] = "ALLOWALL"
        response["X-test-header-org-slug"] = get_attr_opt(organization, "slug")  # TODO: remove
        return response
