from __future__ import annotations

import dataclasses


@dataclasses.dataclass(frozen=True)
class UserlessPrincipal:
    """An authenticated caller with no human behind it, e.g. a service account."""

    name: str = "userless"

    user_id = None
    is_authenticated = True
    is_anonymous = False
    is_active = True
    is_staff = False
    is_superuser = False
    is_sentry_app = False

    def get_display_name(self) -> str:
        return self.name
