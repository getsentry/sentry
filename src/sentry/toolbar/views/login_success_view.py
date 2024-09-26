from csp.decorators import csp_update
from django.http import HttpRequest

from sentry.web.frontend.base import OrganizationView, region_silo_view


@region_silo_view
class LoginSuccessView(OrganizationView):
    @csp_update(
        SCRIPT_SRC=["sentry.io", "*.sentry.io"]
    )  # Append to the CSP enforced in prod. Allows running the inline scripts in the response templates.
    def get(self, request: HttpRequest, organization, project_id_or_slug):
        return self.respond("sentry/toolbar/login-success.html", status=200)
