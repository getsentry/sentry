from functools import wraps

from django.core.urlresolvers import reverse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_protect

from social_auth.backends import get_backend
from social_auth.exceptions import WrongBackend
from social_auth.utils import setting


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
            request.social_auth_backend = get_backend(backend, request,
                                                      redirect)
            if request.social_auth_backend is None:
                raise WrongBackend(backend)
            return func(request, request.social_auth_backend, *args, **kwargs)
        return wrapper
    return dec


def disconnect_view(func):
    @wraps(func)
    def wrapper(request, *args, **kwargs):
        return func(request, *args, **kwargs)

    if setting('SOCIAL_AUTH_FORCE_POST_DISCONNECT'):
        wrapper = require_POST(csrf_protect(wrapper))
    return wrapper
