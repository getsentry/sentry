from functools import wraps

from django.urls import reverse

from social_auth.backends import get_backend
from social_auth.exceptions import WrongBackend


def dsa_view(redirect_name=None):
    """Decorate djangos-social-auth views. Will check and retrieve backend
    or return HttpResponseServerError if backend is not found.

        redirect_name parameter is used to build redirect URL used by backend.
    """

    def dec(func):
        @wraps(func)
        def wrapper(request, backend, *args, **kwargs):
            if redirect_name:
                redirect = reverse(redirect_name, args=(backend,))
            else:
                redirect = request.path
            request.social_auth_backend = get_backend(backend, request, redirect)
            if request.social_auth_backend is None:
                raise WrongBackend(backend)
            return func(request, request.social_auth_backend, *args, **kwargs)

        return wrapper

    return dec
