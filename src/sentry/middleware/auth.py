from __future__ import absolute_import

from django.contrib.auth import middleware

from sentry.models import AnonymousUser


class AuthenticationMiddleware(middleware.AuthenticationMiddleware):
    def process_request(self, request):
        super(AuthenticationMiddleware, self).process_request(request)
        if not request.user.is_authenticated():
            # swap in our custom class
            request.user = AnonymousUser()
