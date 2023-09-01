from __future__ import annotations

from typing import Optional, Tuple

from sentry.backup.dependencies import PrimaryKeyMap
from sentry.backup.scopes import ImportScope


class SanitizeUserImportsMixin:
    """
    The only realistic reason to do a `Global`ly-scoped import is when restoring some full-instance
    backup to a clean install. In this case, one may want to import so-called "superusers": users
    with powerful various instance-wide permissions generally reserved for admins and instance
    maintainers. Thus, for security reasons, running this import in any `ImportScope` other than
    `Global` will sanitize user imports by ignoring imports of the `Authenticator`,
    `UserPermission`, `UserRole`, and `UserRoleUser` models.
    """

    def write_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope
    ) -> Optional[Tuple[int, int]]:
        if scope != ImportScope.Global:
            return None

        return super().write_relocation_import(pk_map, scope)  # type: ignore[misc]
