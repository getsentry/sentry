from functools import wraps
from typing import Any, Callable

from django.contrib import messages
from django.http import HttpResponse, HttpResponseRedirect
from django.urls import reverse
from django.utils.translation import ugettext_lazy as _
from rest_framework.request import Request
from sentry_sdk import Hub

from sentry.utils import auth

ERR_BAD_SIGNATURE = _("The link you followed is invalid or expired.")

# TODO(mgaeta): It's not currently possible to type a Callable's args with kwargs.
EndpointFunc = Callable[..., HttpResponse]


def login_required(func: EndpointFunc) -> EndpointFunc:
    @wraps(func)
    def wrapped(request: Request, *args: Any, **kwargs: Any) -> HttpResponse:
        if not request.user.is_authenticated:
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


def signed_auth_required(func: EndpointFunc) -> EndpointFunc:
    @wraps(func)
    def wrapped(request: Request, *args: Any, **kwargs: Any) -> HttpResponse:
        if not request.user_from_signed_request:
            messages.add_message(request, messages.ERROR, ERR_BAD_SIGNATURE)
            return HttpResponseRedirect(auth.get_login_url())
        return func(request, *args, **kwargs)

    return wrapped


def set_referrer_policy(policy: str) -> Callable[[EndpointFunc], EndpointFunc]:
    def real_decorator(func: EndpointFunc) -> EndpointFunc:
        @wraps(func)
        def wrapped(request: Request, *args: Any, **kwargs: Any) -> HttpResponse:
            response = func(request, *args, **kwargs)
            response["Referrer-Policy"] = policy
            return response

        return wrapped

    return real_decorator


def transaction_start(endpoint: str) -> Callable[[EndpointFunc], EndpointFunc]:
    def decorator(func: EndpointFunc) -> EndpointFunc:
        @wraps(func)
        def wrapped(request: Request, *args: Any, **kwargs: Any) -> HttpResponse:
            with Hub.current.start_transaction(op="http.server", name=endpoint, sampled=True):
                return func(request, *args, **kwargs)

        return wrapped

    return decorator
