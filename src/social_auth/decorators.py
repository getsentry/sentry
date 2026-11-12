from collections.abc import Callable
from functools import wraps

from django.http import HttpRequest, HttpResponseBase
from django.urls import reverse

from social_auth.backends import get_backend
from social_auth.exceptions import WrongBackend


def dsa_view(
    redirect_name: str | None = None,
) -> Callable[[Callable[..., HttpResponseBase]], Callable[..., HttpResponseBase]]:
    """Decorate djangos-social-auth views. Will check and retrieve backend
    or return HttpResponseServerError if backend is not found.

        redirect_name parameter is used to build redirect URL used by backend.
    """

    def dec(func: Callable[..., HttpResponseBase]) -> Callable[..., HttpResponseBase]:
        @wraps(func)
        def wrapper(
            request: HttpRequest, backend: str, *args: object, **kwargs: object
        ) -> HttpResponseBase:
            if redirect_name:
                redirect = reverse(redirect_name, args=(backend,))
            else:
                redirect = request.path
            social_auth_backend = get_backend(backend, request, redirect)
            setattr(request, "social_auth_backend", social_auth_backend)
            if social_auth_backend is None:
                raise WrongBackend(backend)
            return func(request, social_auth_backend, *args, **kwargs)

        return wrapper

    return dec
