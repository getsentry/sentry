from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.toolbar.utils.url import is_origin_allowed
from sentry.web.frontend.base import ProjectView, region_silo_view

TEMPLATE = "sentry/toolbar/iframe.html"


def _get_referrer(request) -> str:
    # 1 R is because of legacy http reasons: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer
    return request.META.get("HTTP_REFERER", "")


def _add_frame_headers(request: HttpRequest, response: HttpResponseBase):
    referrer = _get_referrer(request)

    # This is an alternative to @csp_replace - we need to use this pattern to access the referrer.
    response._csp_replace = {"frame-ancestors": [referrer.strip("/")]}  # type: ignore[attr-defined]
    response["X-Frame-Options"] = "DENY" if referrer == "'none'" else "ALLOWALL"
    return response


@region_silo_view
class IframeView(ProjectView):
    def handle_disabled_member(self, organization: Organization) -> HttpResponse:
        return self._handle_logged_out(self.request)

    def handle_not_2fa_compliant(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        return self._handle_logged_out(request, *args, **kwargs)

    def handle_sudo_required(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        return self._handle_logged_out(request, *args, **kwargs)

    def handle_auth_required(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        return self._handle_logged_out(request, *args, **kwargs)

    def _handle_logged_out(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        response = self.respond(
            TEMPLATE,
            status=200,
            context={
                "referrer": _get_referrer(request),
                "state": "logged-out",
                "logging": request.GET.get("logging", ""),
            },
        )
        return _add_frame_headers(request, response)

    def handle_permission_required(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        response = self.respond(
            TEMPLATE,
            status=200,
            context={
                "referrer": _get_referrer(request),
                "state": "missing-project",
                "logging": request.GET.get("logging", ""),
            },
        )
        return _add_frame_headers(request, response)

    def get(
        self, request: HttpRequest, organization: Organization, project: Project, *args, **kwargs
    ) -> HttpResponse:
        referrer = _get_referrer(request)
        allowed_origins: list[str] = project.get_option("sentry:toolbar_allowed_origins")

        if referrer and is_origin_allowed(referrer, allowed_origins):
            response = self.respond(
                TEMPLATE,
                status=200,
                context={
                    "referrer": referrer,
                    "state": "success",
                    "logging": request.GET.get("logging", ""),
                },
            )
            return _add_frame_headers(request, response)

        response = self.respond(
            TEMPLATE,
            status=200,
            context={
                "referrer": referrer,
                "state": "invalid-domain",
                "logging": request.GET.get("logging", ""),
            },
        )
        return _add_frame_headers(request, response)
