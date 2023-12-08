from django.http.response import HttpResponseBase
from django.urls import reverse
from rest_framework.request import Request

from sentry.auth.helper import AuthHelper
from sentry.web.frontend.base import BaseView, control_silo_view


@control_silo_view
class AuthProviderLoginView(BaseView):
    auth_required = False

    def handle(self, request: Request) -> HttpResponseBase:
        helper = AuthHelper.get_for_request(request)
        if helper is None:
            return self.redirect(reverse("sentry-login"))

        if not helper.is_valid():
            return helper.error("Something unexpected happened during authentication.")
        return helper.current_step()
