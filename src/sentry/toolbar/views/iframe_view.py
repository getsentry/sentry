from typing import Any

from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.toolbar.utils.url import is_origin_allowed
from sentry.web.frontend.base import ProjectView, region_silo_view

TEMPLATE = "sentry/toolbar/iframe.html"


def _get_referrer(request) -> str | None:
    # 1 R is because of legacy http reasons: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer
    return request.META.get("HTTP_REFERER")


@region_silo_view
class IframeView(ProjectView):
    default_context = {}

    def dispatch(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponseBase:
        self.organization_slug = kwargs.get("organization_slug", "")
        self.project_id_or_slug = kwargs.get("project_id_or_slug", "")
        return super().dispatch(request, *args, **kwargs)

    def handle_disabled_member(self, organization: Organization) -> HttpResponse:
        return self._respond_with_state("logged-out")

    def handle_not_2fa_compliant(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        return self._respond_with_state("logged-out")

    def handle_sudo_required(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        return self._respond_with_state("logged-out")

    def handle_auth_required(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        return self._respond_with_state("logged-out")

    def handle_permission_required(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        return self._respond_with_state("missing-project")

    def get(
        self, request: HttpRequest, organization: Organization, project: Project, *args, **kwargs
    ) -> HttpResponse:
        referrer = _get_referrer(request) or ""
        allowed_origins: list[str] = project.get_option("sentry:toolbar_allowed_origins")

        if referrer and is_origin_allowed(referrer, allowed_origins):
            return self._respond_with_state("logged-in")

        return self._respond_with_state("invalid-domain")

    def _respond_with_state(self, state: str):
        response = self.respond(
            TEMPLATE,
            status=200,  # always return 200 so the html will render inside the iframe
            context={
                "referrer": _get_referrer(self.request) or "",
                "state": state,
                "logging": self.request.GET.get("logging", ""),
                "organization_slug": self.organization_slug,
                "project_id_or_slug": self.project_id_or_slug,
            },
        )

        referrer = _get_referrer(self.request) or ""

        # This is an alternative to @csp_replace - we need to use this pattern to access the referrer.
        response._csp_replace = {"frame-ancestors": [referrer.strip("/") or "'none'"]}  # type: ignore[attr-defined]
        response["X-Frame-Options"] = "DENY" if referrer == "" else "ALLOWALL"

        return response
