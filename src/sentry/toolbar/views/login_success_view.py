from django.conf import settings
from django.http import HttpRequest

from sentry.web.frontend.base import OrganizationView, region_silo_view

TEMPLATE = "sentry/toolbar/login-success.html"

session_cookie_name = settings.SESSION_COOKIE_NAME


@region_silo_view
class LoginSuccessView(OrganizationView):
    def get(self, request: HttpRequest, organization, project_id_or_slug):
        return self.respond(
            TEMPLATE,
            status=200,
            context={
                "delay": request.GET.get("delay", 3000),
                "cookie": f"{session_cookie_name}={request.COOKIES.get(session_cookie_name)}",
            },
        )
