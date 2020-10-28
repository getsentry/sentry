from __future__ import absolute_import

from functools import wraps
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.contrib import messages
from django.utils.translation import ugettext_lazy as _

from sentry.utils import auth
from sentry_sdk import Hub

ERR_BAD_SIGNATURE = _("The link you followed is invalid or expired.")


def login_required(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated():
            auth.initiate_login(request, next_url=request.get_full_path())
            if "organization_slug" in kwargs:
                redirect_uri = reverse(
                    "sentry-auth-organization", args=[kwargs["organization_slug"]]
                )
            else:
                redirect_uri = auth.get_login_url()
            return HttpResponseRedirect(redirect_uri)
        return func(request, *args, **kwargs)

    return wrapped


def signed_auth_required(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not request.user_from_signed_request:
            messages.add_message(request, messages.ERROR, ERR_BAD_SIGNATURE)
            return HttpResponseRedirect(auth.get_login_url())
        return func(request, *args, **kwargs)

    return wrapped


def transaction_start(endpoint):
    def decorator(func):
        @wraps(func)
        def wrapped(request, *args, **kwargs):
            with Hub.current.start_transaction(op="http.server", name=endpoint, sampled=True):
                return func(request, *args, **kwargs)

        return wrapped

    return decorator
