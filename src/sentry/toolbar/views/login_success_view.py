from django.http import HttpRequest

from sentry.toolbar.views.base import ToolbarView
from sentry.web.frontend.base import region_silo_view


@region_silo_view
class LoginSuccessView(ToolbarView):
    def get(self, request: HttpRequest, organization, project):
        return self.respond("sentry/toolbar/login-success.html", status=200)
