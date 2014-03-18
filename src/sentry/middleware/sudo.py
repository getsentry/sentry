"""
sentry.middleware.sudo
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.utils.sudo import has_sudo_privileges, SUDO_COOKIE_NAME


class SudoMiddleware(object):
    def process_request(self, request):
        request._sentry_sudo = None
        request.is_sudo = lambda: has_sudo_privileges(request)

    def process_response(self, request, response):
        if request._sentry_sudo is None:
            return response

        # We have explicitly had sudo revoked, so clean up cookie
        if request._sentry_sudo is False and SUDO_COOKIE_NAME in request.COOKIES:
            response.delete_cookie(SUDO_COOKIE_NAME)
            return response

        # Sudo mode has been granted, and we have a token to send back to the user agent
        if request._sentry_sudo is True and hasattr(request, '_sentry_sudo_token'):
            token = request._sentry_sudo_token
            max_age = request._sentry_sudo_max_age
            response.set_cookie(
                SUDO_COOKIE_NAME, token,
                max_age=max_age,  # If max_age is None, it's a session cookie
                secure=request.is_secure(),
                httponly=True,  # Not accessible by JavaScript
            )

        return response
