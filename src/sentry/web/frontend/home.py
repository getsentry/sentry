from django.http import HttpRequest
from django.http.response import HttpResponseBase

from sentry.web.frontend.base import BaseView


class HomeView(BaseView):
    def get(self, request: HttpRequest) -> HttpResponseBase:
        return self.redirect_to_org(request)
