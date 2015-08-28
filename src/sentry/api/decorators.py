from __future__ import absolute_import

import json

from django.http import HttpResponse
from functools import wraps

from sentry.models import ApiKey


def is_considered_sudo(request):
    return request.is_sudo() or \
        isinstance(request.auth, ApiKey)


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
            return HttpResponse(json.dumps(data), status=401)
        return func(self, request, *args, **kwargs)
    return wrapped
