from __future__ import absolute_import

from django.contrib.auth import logout
from django.contrib.auth.models import AnonymousUser

from sentry.web.frontend.base import BaseView
from sentry.utils import auth


class AuthLogoutView(BaseView):
    auth_required = False

    def handle(self, request):
        next = request.GET.get('next', '')
        if not next.startswith('/'):
            next = auth.get_login_url()
        logout(request)
        request.user = AnonymousUser()
        return self.redirect(next)
