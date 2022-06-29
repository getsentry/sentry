import ipaddress
from typing import Any
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.utils.crypto import constant_time_compare

from sentry import options
from sentry.utils.cache import memoize

INTERNAL_NETWORKS = [
    ipaddress.ip_network(str(net), strict=False) for net in settings.INTERNAL_SYSTEM_IPS
]


def is_internal_ip(request):
    ip = ipaddress.ip_address(str(request.META["REMOTE_ADDR"]))
    return any(ip in net for net in INTERNAL_NETWORKS)


def get_system_token():
    token = options.get("sentry:system-token")
    if not token:
        token = uuid4().hex
        options.set("sentry:system-token", token)
    return token


class SystemToken:
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
        return False

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


def is_system_auth(auth: Any) -> bool:
    """:returns True when Sentry itself is hitting the API."""
    return isinstance(auth, SystemToken)
