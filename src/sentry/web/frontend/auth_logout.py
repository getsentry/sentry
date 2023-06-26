from django.contrib.auth import REDIRECT_FIELD_NAME, logout
from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.utils.http import is_safe_url
from rest_framework.request import Request

from sentry.utils import auth
from sentry.web.frontend.base import BaseView


class AuthLogoutView(BaseView):
    auth_required = False

    def redirect(self, request: Request) -> HttpResponse:
        next_url = request.GET.get(REDIRECT_FIELD_NAME, "")
        if not is_safe_url(next_url, allowed_hosts=(request.get_host(),)):
            next_url = auth.get_login_url()
        return super().redirect(next_url)

    def get(self, request: Request) -> HttpResponse:
        return self.respond("sentry/logout.html")

    def post(self, request: Request) -> HttpResponse:
        logout(request)
        request.user = AnonymousUser()
        return self.redirect(request)
