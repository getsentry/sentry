from __future__ import absolute_import, print_function

import ipaddress
import six

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.utils.crypto import constant_time_compare
from uuid import uuid4

from sentry import options
from sentry.utils.cache import memoize


INTERNAL_NETWORKS = [
    ipaddress.ip_network(six.text_type(net), strict=False) for net in settings.INTERNAL_SYSTEM_IPS
]


def is_internal_ip(request):
    ip = ipaddress.ip_address(six.text_type(request.META["REMOTE_ADDR"]))
    return any(ip in net for net in INTERNAL_NETWORKS)


def get_system_token():
    token = options.get("sentry:system-token")
    if not token:
        token = uuid4().hex
        options.set("sentry:system-token", token)
    return token


class SystemToken(object):
    """
    API token authenticating the system user.

    The system token has all authorization scopes, but the underlying SystemUser
    does not have permission to access any endpoints. It can be white listed
    using ``SystemPermission``.
    """

    id = "<system>"
    token = "<system.secret-key>"
    application = None
    organization_id = None

    @classmethod
    def from_request(cls, request, token):
        """Returns a system token if this is a valid system request."""
        system_token = get_system_token()
        if constant_time_compare(system_token, token) and is_internal_ip(request):
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

    @memoize
    def user(self):
        user = AnonymousUser()
        user.is_active = True
        return user

    def get_allowed_origins(self):
        return []

    def get_audit_log_data(self):
        return {"label": "System", "key": "<system>", "scopes": -1}

    def get_scopes(self):
        return list(settings.SENTRY_SCOPES)

    def has_scope(self, scope):
        return True

    def refresh(self, expires_at=None):
        pass


def is_system_auth(auth):
    return isinstance(auth, SystemToken)
