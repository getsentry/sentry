"""
sentry.utils.auth
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import hashlib
import hmac
from django.conf import settings as dj_settings
from django.contrib.auth.models import User
from django.contrib.auth.backends import ModelBackend
from sentry.conf import settings


def get_signature(message, timestamp, key=None):
    if not key:
        key = settings.KEY
    return hmac.new(str(key), '%s %s' % (timestamp, message), hashlib.sha1).hexdigest()


def get_auth_header(signature, timestamp, client, api_key=None):
    header = [
        ('sentry_timestamp', timestamp),
        ('sentry_signature', signature),
        ('sentry_client', client),
    ]
    if api_key:
        header.append(('sentry_key', api_key))

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
        try:
            # Assume username is a login and attempt to login.
            if '@' not in username:
                user = User.objects.get(username__iexact=username)

            # Treat username as an e-mail address and attempt to login.
            elif '@' in username:
                user = User.objects.get(email__iexact=username)
        except User.DoesNotExist:
            return None

        if user.check_password(password):
            return user

        return None
