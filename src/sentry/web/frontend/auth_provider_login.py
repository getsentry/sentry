import logging

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.urls import reverse

from sentry.auth.helper import AuthHelper
from sentry.web.frontend.base import BaseView, control_silo_view

logger = logging.getLogger("sentry.saml_setup_error")


@control_silo_view
class AuthProviderLoginView(BaseView):
    auth_required = False

    def handle(self, request: HttpRequest) -> HttpResponseBase:
        helper = AuthHelper.get_for_request(request)
        if helper is None:
            return self.redirect(reverse("sentry-login"))

        if not helper.is_valid():
            logger.info(
                "AuthProviderLoginView",
                extra=helper.state.get_state(),
            )
            return helper.error("Something unexpected happened during authentication.")
        return helper.current_step()
