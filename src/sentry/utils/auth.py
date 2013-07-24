"""
sentry.utils.auth
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.conf import settings
from django.contrib.auth.backends import ModelBackend
from sentry.models import User


def parse_auth_header(header):
    return dict(map(lambda x: x.strip().split('='), header.split(' ', 1)[1].split(',')))


def get_auth_providers():
    return [
        key for key, cfg_names
        in settings.AUTH_PROVIDERS.iteritems()
        if all(getattr(settings, c, None) for c in cfg_names)
    ]


class EmailAuthBackend(ModelBackend):
    """
    Authenticate against django.contrib.auth.models.User.

    Supports authenticating via an email address or a username.
    """
    def authenticate(self, username=None, password=None):
        qs = User.objects.exclude(password='!')
        try:
            # Assume username is a login and attempt to login.
            user = qs.get(username__iexact=username)
        except User.DoesNotExist:
            if '@' in username:
                # email isn't guaranteed unique
                for user in qs.filter(email__iexact=username):
                    if not user.password:
                        continue
                    if user.check_password(password):
                        return user
            return None

        try:
            if user.password and user.check_password(password):
                return user
        except ValueError:
            return None

        return None
