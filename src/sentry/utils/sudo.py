"""
sentry.utils.sudo
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from functools import wraps
from urlparse import urlparse, urlunparse

from django.conf import settings
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect, QueryDict
from django.utils.crypto import get_random_string

SUDO_COOKIE_NAME = getattr(settings, 'SUDO_COOKIE_NAME', 'sudo')


def grant_sudo_privileges(request, response, max_age=3600):
    """
    Assigns a random token to the user's session that allows them to have elevated permissions
    """
    # Token doesn't need to be unique, just needs to be unpredictable and match the cookie and the session
    token = get_random_string()
    request.session[SUDO_COOKIE_NAME] = token
    request.session.modified = True
    response.set_cookie(
        SUDO_COOKIE_NAME, token,
        max_age=max_age,  # If max_age is None, it's a session cookie
        secure=request.is_secure(),
        httponly=True,  # Not accessible by JavaScript
    )
    return response


def has_sudo_privileges(request):
    """
    Check if a request is allowed to perform sudo actions
    """
    try:
        return (
            request.user.is_authenticated() and
            request.COOKIES[SUDO_COOKIE_NAME] == request.session[SUDO_COOKIE_NAME]
        )
    except KeyError:
        pass
    return False


def redirect_to_sudo(next_url):
    """
    Redirects the user to the login page, passing the given 'next' page
    """
    sudo_url_parts = list(urlparse(reverse('sentry-sudo')))

    querystring = QueryDict(sudo_url_parts[4], mutable=True)
    querystring['next'] = next_url
    sudo_url_parts[4] = querystring.urlencode(safe='/')

    return HttpResponseRedirect(urlunparse(sudo_url_parts))


def sudo_required(func):
    """
    Enforces a view to have elevated privileges
    """
    @wraps(func)
    def inner(request, *args, **kwargs):
        if not has_sudo_privileges(request):
            return redirect_to_sudo(request.get_full_path())
        return func(request, *args, **kwargs)
    return inner
