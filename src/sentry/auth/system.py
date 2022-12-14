from __future__ import annotations

import ipaddress
from typing import Any
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http.request import HttpRequest
from django.utils.crypto import constant_time_compare

from sentry import options
from sentry.services.hybrid_cloud.auth import AuthenticatedToken
from sentry.utils.cache import memoize

INTERNAL_NETWORKS = [
    ipaddress.ip_network(str(net), strict=False) for net in settings.INTERNAL_SYSTEM_IPS
]


def is_internal_ip(request: HttpRequest) -> bool:
    ip = ipaddress.ip_address(str(request.META["REMOTE_ADDR"]))
    return any(ip in net for net in INTERNAL_NETWORKS)


def get_system_token() -> str:
    token = options.get("sentry:system-token")
    if not token:
        token = uuid4().hex
        options.set("sentry:system-token", token)
    return token  # type: ignore[no-any-return]


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
    def from_request(cls, request: HttpRequest, token: str) -> SystemToken | None:
        """Returns a system token if this is a valid system request."""
        system_token = get_system_token()
        if constant_time_compare(system_token, token) and is_internal_ip(request):
            return cls()
        return None

    def __eq__(self, other: object) -> bool:
        return isinstance(other, self.__class__)

    def __ne__(self, other: object) -> bool:
        return not self.__eq__(other)

    def __hash__(self) -> int:
        return 1  # singleton

    def is_expired(self) -> bool:
        return False

    @memoize  # type: ignore[misc]
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
    if isinstance(auth, AuthenticatedToken):
        return auth.kind == "system"
    return isinstance(auth, SystemToken)
