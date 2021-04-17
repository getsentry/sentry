from django.urls import reverse

from sentry.auth.helper import AuthHelper
from sentry.web.frontend.base import BaseView


class AuthProviderLoginView(BaseView):
    auth_required = False

    def handle(self, request):
        helper = AuthHelper.get_for_request(request)
        if helper is None:
            return self.redirect(reverse("sentry-login"))

        if not helper.pipeline_is_valid():
            return helper.error("Something unexpected happened during authentication.")
        return helper.current_step()
