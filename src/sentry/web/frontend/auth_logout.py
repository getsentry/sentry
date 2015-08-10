from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse
from django.contrib.auth import logout

from sentry.models import AnonymousUser
from sentry.web.frontend.base import BaseView


class AuthLogoutView(BaseView):
    auth_required = False

    def handle(self, request):
        logout(request)
        request.user = AnonymousUser()

        return self.redirect(reverse('sentry'))
