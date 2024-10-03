from django.http import HttpRequest

from sentry.web.frontend.base import OrganizationView, region_silo_view

SUCCESS_TEMPLATE = "sentry/toolbar/login-success.html"


@region_silo_view
class LoginSuccessView(OrganizationView):
    def get(self, request: HttpRequest, organization, project_id_or_slug):
        return self.respond(SUCCESS_TEMPLATE, status=200)
