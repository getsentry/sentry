from typing import Any

from django.http import HttpRequest, HttpResponse

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.toolbar.utils.url import check_origin
from sentry.web.frontend.base import OrganizationView, region_silo_view

REFERRER_HEADER = "HTTP_REFERER"  # 1 R is the spelling used here: https://docs.djangoproject.com/en/5.1/ref/request-response/
SUCCESS_TEMPLATE = "sentry/toolbar/iframe.html"
INVALID_TEMPLATE = "sentry/toolbar/iframe-invalid.html"


@region_silo_view
class IframeView(OrganizationView):
    def respond(self, template: str, context: dict[str, Any] | None = None, status: int = 200):
        response = super().respond(template, context=context, status=status)
        # These HTTP headers allow response to be embedded in an iframe.
        response["X-Frame-Options"] = "ALLOWALL"
        response._csp_replace = {  # type: ignore[attr-defined]
            # This is an alternative to @csp_replace - we need to use this pattern to access the referrer.
            "frame-ancestors": [self.request.META.get(REFERRER_HEADER, "'none'")]
        }
        return response

    def handle_auth_required(self, request: HttpRequest, *args, **kwargs):
        # Override redirects to /auth/login
        return HttpResponse(status=401)

    def handle_permission_required(self, request: HttpRequest, *args, **kwargs):
        # Override redirects to /auth/login
        return HttpResponse(status=403)

    def convert_args(self, request: HttpRequest, organization_slug: str, project_id_or_slug: int | str, *args: Any, **kwargs: Any) -> tuple[tuple[Any, ...], dict[str, Any]]:  # type: ignore[override]
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)
        organization: Organization | None = kwargs["organization"]
        active_project: Project | None = (
            self.get_active_project(
                request=request,
                organization=organization,  # type: ignore[arg-type]
                project_id_or_slug=project_id_or_slug,
            )
            if organization
            else None
        )
        kwargs["project"] = active_project
        return args, kwargs

    def get(
        self, request: HttpRequest, organization: Organization, project: Project, *args, **kwargs
    ):
        referrer = request.META.get(REFERRER_HEADER)
        if not project:
            return self.respond(
                INVALID_TEMPLATE,
                status=404,
                context={"referrer": referrer, "has_project": False},
            )

        allowed_origins: list[str] = project.get_option("sentry:toolbar_allowed_origins")
        origin_allowed, info_msg = check_origin(referrer, allowed_origins)
        if not origin_allowed:
            return self.respond(
                INVALID_TEMPLATE,
                status=403,
                context={
                    "referrer": referrer,
                    "has_project": True,
                    "allow_origin": False,
                },
            )

        return self.respond(SUCCESS_TEMPLATE, status=200, context={"referrer": referrer})
