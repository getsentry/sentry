from csp.decorators import csp_update  # type: ignore[import-untyped]
from django.http import HttpRequest

from sentry.toolbar.views import TOOLBAR_CSP_SCRIPT_SRC
from sentry.web.frontend.base import OrganizationView, region_silo_view


@region_silo_view
class LoginSuccessView(OrganizationView):
    @csp_update(
        SCRIPT_SRC=TOOLBAR_CSP_SCRIPT_SRC
    )  # Appends to the CSP enforced in prod. Allows running the inline scripts in the response templates.
    def get(self, request: HttpRequest, organization, project_id_or_slug):
        return self.respond("sentry/toolbar/login-success.html", status=200)
