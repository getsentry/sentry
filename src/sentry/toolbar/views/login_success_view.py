from django.conf import settings
from django.http import HttpRequest

from sentry.web.frontend.base import OrganizationView, region_silo_view

TEMPLATE = "sentry/toolbar/login-success.html"

session_cookie_name = settings.SESSION_COOKIE_NAME

# touch 123


@region_silo_view
class LoginSuccessView(OrganizationView):
    def get(self, request: HttpRequest, organization, project_id_or_slug):
        delay_ms = int(request.GET.get("delay") or 3000)
        return self.respond(
            TEMPLATE,
            status=200,
            context={
                "organization_slug": organization.slug,
                "delay_sec": int(delay_ms / 1000),
                "delay_ms": delay_ms,
                "cookie": f"{session_cookie_name}={request.COOKIES.get(session_cookie_name)}",
                "token": "",
            },
        )
