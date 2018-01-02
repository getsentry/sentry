from __future__ import absolute_import

from rest_framework.response import Response
from functools import wraps

from sentry.models import ApiKey, ApiToken


def is_considered_sudo(request):
    # Users without a password are assumed to always have sudo powers
    user = request.user

    return request.is_sudo() or \
        isinstance(request.auth, ApiKey) or \
        isinstance(request.auth, ApiToken) or \
        user.is_authenticated() and not user.has_usable_password()


def sudo_required(func):
    @wraps(func)
    def wrapped(self, request, *args, **kwargs):
        # If we are already authenticated through an API key we do not
        # care about the sudo flag.
        if not is_considered_sudo(request):
            # TODO(dcramer): support some kind of auth flow to allow this
            # externally
            data = {
                "error": "Account verification required.",
                "sudoRequired": True,
                "username": request.user.username,
            }
            return Response(data, status=401)
        return func(self, request, *args, **kwargs)

    return wrapped
