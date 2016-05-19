from __future__ import absolute_import

from django.contrib.auth import middleware

from sentry.utils.linksign import process_signature


class AuthenticationMiddleware(middleware.AuthenticationMiddleware):

    def process_request(self, request):
        middleware.AuthenticationMiddleware.process_request(self, request)
        request.user_from_signed_request = False

        # If there is a valid signature on the request we override the
        # user with the user contained within the signature.
        user = process_signature(request)
        if user is not None:
            request.user = user
            request.user_from_signed_request = True
