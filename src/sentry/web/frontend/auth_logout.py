from __future__ import absolute_import

from django.contrib.auth import logout, REDIRECT_FIELD_NAME
from django.contrib.auth.models import AnonymousUser
from django.utils.http import is_safe_url

from sentry.web.frontend.base import BaseView
from sentry.utils import auth


class AuthLogoutView(BaseView):
    auth_required = False

    def redirect(self, request):
        next = request.GET.get(REDIRECT_FIELD_NAME, "")
        if not is_safe_url(next, host=request.get_host()):
            next = auth.get_login_url()
        return super(AuthLogoutView, self).redirect(next)

    def get(self, request):
        return self.respond("sentry/logout.html")

    def post(self, request):
        logout(request)
        request.user = AnonymousUser()
        return self.redirect(request)
