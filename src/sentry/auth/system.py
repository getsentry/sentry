from __future__ import annotations

import ipaddress
import logging
import secrets
from typing import Any

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http.request import HttpRequest
from django.utils.crypto import constant_time_compare
from django.utils.functional import cached_property

from sentry import options

INTERNAL_NETWORKS = [
    ipaddress.ip_network(str(net), strict=False) for net in settings.INTERNAL_SYSTEM_IPS
]

logger = logging.getLogger(__name__)


def is_internal_ip(request: HttpRequest) -> bool:
    ip = ipaddress.ip_address(str(request.META["REMOTE_ADDR"]))
    return any(ip in net for net in INTERNAL_NETWORKS)


def get_system_token() -> str:
    token = options.get("sentry:system-token")
    if not token:
        token = secrets.token_hex()
        options.set("sentry:system-token", token, channel=options.UpdateChannel.APPLICATION)
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
    scoping_organization_id = None

    @classmethod
    def from_request(cls, request: HttpRequest, token: str) -> SystemToken | None:
        """Returns a system token if this is a valid system request."""
        system_token = get_system_token()
        if constant_time_compare(system_token, token):
            if is_internal_ip(request):
                return cls()
            # else:
            # We have a valid system token, but the remote is not an internal IP
            # This can happen because:
            # - the system token was leaked (unlikely)
            # - an internal service (eg symbolicator) is trying to use the system token,
            #   but is not covered by the internal IP ranges (more likely)
            logger.error("Trying to use `SystemToken` from non-internal IP")

        return None

    def __eq__(self, other: object) -> bool:
        return isinstance(other, self.__class__)

    def __ne__(self, other: object) -> bool:
        return not self.__eq__(other)

    def __hash__(self) -> int:
        return 1  # singleton

    def is_expired(self) -> bool:
        return False

    @cached_property
    def user(self) -> AnonymousUser:
        user = AnonymousUser()
        user.is_active = True
        return user

    def get_allowed_origins(self) -> list[str]:
        return []

    def get_audit_log_data(self) -> dict[str, Any]:
        return {"label": "System", "key": "<system>", "scopes": -1}

    def get_scopes(self) -> list[str]:
        return list(settings.SENTRY_SCOPES)

    def has_scope(self, scope: str) -> bool:
        return True

    def refresh(self, expires_at: object | None = None) -> None:
        pass


def is_system_auth(auth: object) -> bool:
    """:returns True when Sentry itself is hitting the API."""
    from sentry.auth.services.auth import AuthenticatedToken

    if isinstance(auth, AuthenticatedToken):
        return auth.kind == "system"
    return isinstance(auth, SystemToken)
