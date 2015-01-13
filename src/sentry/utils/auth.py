"""
sentry.utils.auth
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings
from django.contrib.auth.backends import ModelBackend
from django.core.urlresolvers import reverse

from sentry.models import User


def parse_auth_header(header):
    return dict(map(lambda x: x.strip().split('='), header.split(' ', 1)[1].split(',')))


def get_auth_providers():
    return [
        key for key, cfg_names
        in settings.AUTH_PROVIDERS.iteritems()
        if all(getattr(settings, c, None) for c in cfg_names)
    ]


def get_login_redirect(request):
    default = reverse('sentry')
    login_url = request.session.pop('_next', None) or default
    if '//' in login_url:
        login_url = default
    elif login_url.startswith(reverse('sentry-login')):
        login_url = default
    return login_url


def find_users(username, with_valid_password=True):
    """
    Return a list of users that match a username
    and falling back to email
    """
    qs = User.objects
    if with_valid_password:
        qs = qs.exclude(password='!')

    try:
        # First, assume username is an iexact match for username
        user = qs.get(username__iexact=username)
        return [user]
    except User.DoesNotExist:
        # If not, we can take a stab at guessing it's an email address
        if '@' in username:
            # email isn't guaranteed unique
            return list(qs.filter(email__iexact=username))
    return None


class EmailAuthBackend(ModelBackend):
    """
    Authenticate against django.contrib.auth.models.User.

    Supports authenticating via an email address or a username.
    """
    def authenticate(self, username=None, password=None):
        users = find_users(username)
        if users:
            for user in users:
                try:
                    if user.password and user.check_password(password):
                        return user
                except ValueError:
                    continue
        return None
