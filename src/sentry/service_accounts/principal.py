from __future__ import annotations

import dataclasses


@dataclasses.dataclass(frozen=True)
class ServiceAccountPrincipal:
    """
    A service account on ``request.user``, implementing ``RequestPrincipal``.

    It has no user id and no user attributes (email, password, 2FA), so code that needs
    a person fails loudly. What the account may do comes from ``request.access``.
    """

    service_account_id: int
    organization_id: int
    name: str

    is_authenticated = True
    is_anonymous = False
    is_active = True
    is_staff = False
    is_superuser = False
    is_sentry_app = False
    is_suspended = False

    def get_display_name(self) -> str:
        return self.name
