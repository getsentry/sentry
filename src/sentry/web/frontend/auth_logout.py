from __future__ import absolute_import

from django.contrib.auth import logout
from django.contrib.auth.models import AnonymousUser

from sentry.web.frontend.base import BaseView
from sentry.utils.auth import get_login_redirect


class AuthLogoutView(BaseView):
    auth_required = False

    def handle(self, request):
        rv = get_login_redirect(request)
        logout(request)
        request.user = AnonymousUser()
        return self.redirect(rv)
