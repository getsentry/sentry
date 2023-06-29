from django.http import HttpResponse
from rest_framework.request import Request

from sentry.web.frontend.base import BaseView


class HomeView(BaseView):
    def get(self, request: Request) -> HttpResponse:
        return self.redirect_to_org(request)
