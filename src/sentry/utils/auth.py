"""
sentry.utils.auth
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.conf import settings as dj_settings
from django.contrib.auth.models import User
from django.contrib.auth.backends import ModelBackend
from sentry.conf import settings


def get_auth_header(client, api_key=None, secret_key=None):
    header = [
        ('sentry_client', client),
        ('sentry_version', '3'),
    ]

    if api_key:
        header.append(('sentry_key', api_key))
    if secret_key:
        header.append(('sentry_secret', secret_key))

    return 'Sentry %s' % ', '.join('%s=%s' % (k, v) for k, v in header)


def parse_auth_header(header):
    return dict(map(lambda x: x.strip().split('='), header.split(' ', 1)[1].split(',')))


def get_auth_providers():
    return [key
        for key, cfg_names
        in settings.AUTH_PROVIDERS.iteritems()
        if all(getattr(dj_settings, c, None) for c in cfg_names)]


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
