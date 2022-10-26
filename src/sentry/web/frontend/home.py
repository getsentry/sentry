from django.http import HttpResponseRedirect
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils.auth import is_valid_redirect
from sentry.utils.client_state import get_client_state_redirect_uri
from sentry.web.frontend.base import BaseView


class HomeView(BaseView):
    def get(self, request: Request) -> Response:
        # If the active organization has an ongoing onboarding session, redirect to onboarding
        if self.active_organization:
            redirect_uri = get_client_state_redirect_uri(self.active_organization.slug, None)
            if redirect_uri and is_valid_redirect(
                redirect_uri, allowed_hosts=(request.get_host(),)
            ):
                return HttpResponseRedirect(redirect_uri)

        return self.redirect_to_org(request)
