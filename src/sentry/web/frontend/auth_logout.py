from django.contrib.auth import REDIRECT_FIELD_NAME, logout
from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest, HttpResponse
from django.utils.http import url_has_allowed_host_and_scheme

from sentry.utils import auth
from sentry.web.frontend.base import BaseView


class AuthLogoutView(BaseView):
    auth_required = False

    def redirect(self, request: HttpRequest) -> HttpResponse:
        next_url = request.GET.get(REDIRECT_FIELD_NAME, "")
        if not url_has_allowed_host_and_scheme(next_url, allowed_hosts=(request.get_host(),)):
            next_url = auth.get_login_url()
        return super().redirect(next_url)

    def get(self, request: HttpRequest) -> HttpResponse:
        return self.respond("sentry/logout.html")

    def post(self, request: HttpRequest) -> HttpResponse:
        logout(request)
        request.user = AnonymousUser()
        return self.redirect(request)
