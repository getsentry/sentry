from __future__ import annotations

import dataclasses
from typing import NoReturn

from sentry.api.exceptions import UserRequired


@dataclasses.dataclass(frozen=True)
class ServiceAccountId:
    """
    A service account's ``request.user.id``.

    It never equals a user id, and turning it into an int raises ``UserRequired``, so a
    lookup or write keyed on ``request.user.id`` fails instead of reaching the user with
    the same number.
    """

    service_account_id: int

    def __int__(self) -> NoReturn:
        raise UserRequired()

    __index__ = __int__

    def __str__(self) -> str:
        return f"service_account:{self.service_account_id}"


@dataclasses.dataclass(frozen=True)
class ServiceAccountPrincipal:
    """
    A service account on ``request.user``, implementing ``RequestPrincipal``.

    It has no user id and no human attributes (email, password, 2FA), so code that needs
    a person fails loudly. What the account may do comes from ``request.access``.
    """

    service_account_id: int
    organization_id: int
    name: str

    user_id = None
    is_authenticated = True
    is_anonymous = False
    is_active = True
    is_staff = False
    is_superuser = False
    is_sentry_app = False
    is_suspended = False

    @property
    def id(self) -> ServiceAccountId:
        return ServiceAccountId(self.service_account_id)

    def get_display_name(self) -> str:
        return self.name
