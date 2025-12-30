from django.http import HttpRequest
from django.http.response import HttpResponseBase

from sentry.web.frontend.base import BaseView, all_silo_view


@all_silo_view
class HomeView(BaseView):
    def get(self, request: HttpRequest) -> HttpResponseBase:
        return self.redirect_to_org(request)
