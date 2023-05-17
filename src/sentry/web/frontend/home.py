from rest_framework.request import Request
from rest_framework.response import Response

from sentry.web.frontend.base import BaseView


class HomeView(BaseView):
    def get(self, request: Request) -> Response:
        return self.redirect_to_org(request)
