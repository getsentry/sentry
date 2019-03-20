from __future__ import absolute_import, print_function

import logging

from django.conf import settings
from django.utils.crypto import constant_time_compare
from hashlib import sha1
from uuid import uuid4

from sentry import options

logger = logging.getLogger('sentry.auth')


class SystemUser(object):
    """
    Singleton user representing a system that is part of Sentry.

    The system user is a superuser that is not tied to an organization or real
    user account. Unlike other superusers but similar to ``AnonymousUser``, it
    has ``is_anonymous`` set.
    """

    id = -1  # Allow database queries

    username = '<system>'
    is_staff = True
    is_active = True
    is_superuser = True
    is_system = True

    def __str__(self):
        return 'SystemUser'

    def __eq__(self, other):
        return isinstance(other, self.__class__)

    def __ne__(self, other):
        return not self.__eq__(other)

    def __hash__(self):
        return 1  # singleton

    def is_anonymous(self):
        return True

    def is_authenticated(self):
        return True


def is_internal_ip(request):
    if settings.INTERNAL_IPS:
        ip = request.META['REMOTE_ADDR']
        if not any(ip in addr for addr in settings.INTERNAL_IPS):
            return False

    return True


def get_system_token():
    token = options.get('sentry:system-token')
    if not token:
        token = sha1(uuid4().bytes).hexdigest()
        logger.info('auth.generated-system-token', extra={'system-token': token})
        options.set('sentry:system-token', token)
    return token


class SystemToken(object):
    """
    API token that gives superuser access to the system user.
    """

    id = '<system>'
    token = '<system.secret-key>'
    user = SystemUser()
    application = None

    @classmethod
    def from_request(cls, request, token):
        """Returns a system token if this is a valid system request."""
        system_token = get_system_token()
        if system_token \
                and constant_time_compare(system_token, token) \
                and is_internal_ip(request):
            return cls()
        return None

    def __eq__(self, other):
        return isinstance(other, self.__class__)

    def __ne__(self, other):
        return not self.__eq__(other)

    def __hash__(self):
        return 1  # singleton

    def is_expired(self):
        False

    def get_allowed_origins(self):
        return []

    def get_audit_log_data(self):
        return {
            'label': 'System',
            'key': '<system>',
            'scopes': -1,
        }

    def get_scopes(self):
        return list(settings.SENTRY_SCOPES)

    def has_scope(self, scope):
        return True

    def refresh(self, expires_at=None):
        pass
