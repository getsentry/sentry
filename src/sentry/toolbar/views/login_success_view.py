from django.http import HttpRequest

from sentry.toolbar.views.base import ToolbarView
from sentry.web.frontend.base import region_silo_view

SUCCESS_TEMPLATE = "sentry/toolbar/login-success.html"


@region_silo_view
class LoginSuccessView(ToolbarView):
    def get(self, request: HttpRequest, organization, project):
        return self.respond(SUCCESS_TEMPLATE, status=200)
