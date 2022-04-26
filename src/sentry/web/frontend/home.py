from django.http import HttpResponseRedirect
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils.client_state import get_client_state_redirect_uri
from sentry.web.frontend.base import BaseView


class HomeView(BaseView):
    def get(self, request: Request) -> Response:
        organization = self.get_active_organization(request)
        if organization:
            redirect_uri = get_client_state_redirect_uri(organization.slug, None)
            if redirect_uri:
                return HttpResponseRedirect(redirect_uri)

        return self.redirect_to_org(request)
