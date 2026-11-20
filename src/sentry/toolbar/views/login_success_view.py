from typing import Any

from django.http import HttpRequest, HttpResponse

from sentry.web.frontend.base import BaseView, cell_silo_view

TEMPLATE = "sentry/toolbar/login-success.html"


@cell_silo_view
class LoginSuccessView(BaseView):
    """
    Opened as a popup by the toolbar's Login button. No login happens; visitors
    may not have a Sentry account, so the notice needs no auth.
    """

    auth_required = False

    def get(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        return self.respond(TEMPLATE, status=200)
