from django.http import HttpResponseRedirect
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils.client_state import get_client_state
from sentry.web.frontend.base import BaseView


class HomeView(BaseView):
    def get(self, request: Request) -> Response:
        organization = self.get_active_organization(request)
        if organization:
            state = get_client_state("onboarding", organization.slug, None)
            if state.get("state") == "started" and state.get("url"):
                return HttpResponseRedirect(f'/onboarding/{organization.slug}/{state["url"]}')

        return self.redirect_to_org(request)
