"""
when you update the app, if and only if you want warnings to show in different places in the UI
then you should update the option with the new expected required permissions and their required level

if you don't update the option, nothing will break since the option only lists out required permissions:
if the user's integration contains more permissions than we expect we just ignore it, since there are
inconsistencies with what permissions we store in the metadata anyways based on whether the integration
is for an org or a single user

at the moment there's no way to gate warnings in the UI by which perm is missing, but we can add that
where the warnings are implemented since this API returns the list of missing scopes / levels
"""

import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any, TypedDict

from sentry import options

logger = logging.getLogger(__name__)

GITHUB_APP_REQUIRED_PERMISSIONS_OPTION = "github-app.required-permissions"

# Approximately when the Sentry GitHub App's requested permissions last changed. A snapshot
# recorded before this was read against the old required set, so it says nothing
# about whether an install is missing anything from the current one, and treating
# it as authoritative nags people over permissions we never asked them for.
GITHUB_APP_PERMISSIONS_UPDATED_AT = datetime(2026, 7, 11, tzinfo=UTC)


def _parse_last_refresh_at(metadata: Mapping[str, Any] | None) -> datetime | None:
    """When the permissions in `metadata` were read off a fresh installation token.

    Written by the token refresh as a naive UTC isoformat string, so a value
    without an offset is read back as UTC rather than rejected.
    """
    raw = (metadata or {}).get("last_refresh_at")
    if not isinstance(raw, str):
        return None
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def is_permissions_snapshot_stale(metadata: Mapping[str, Any] | None) -> bool:
    """True when metadata["permissions"] is too old to judge an install against.

    An absent or unparseable stamp counts as stale: metadata only started
    carrying one when the app's permissions were already changing, so a missing
    one means the snapshot is older than any date we would set here.
    """
    last_refresh_at = _parse_last_refresh_at(metadata)
    return last_refresh_at is None or last_refresh_at < GITHUB_APP_PERMISSIONS_UPDATED_AT


class GitHubAppPermission(TypedDict):
    scope: str
    level: int


class MissingGithubAppPermission(TypedDict):
    expected: GitHubAppPermission
    actual: GitHubAppPermission | None


PERMISSION_LEVELS = {
    "read": 1,
    "write": 2,
    "admin": 3,
}


def _quantify_github_app_permissions(
    permissions: Mapping[str, str],
) -> dict[str, int]:
    return {scope: PERMISSION_LEVELS[level] for scope, level in permissions.items()}


def get_missing_github_app_permissions(
    metadata: Mapping[str, Any],
) -> list[MissingGithubAppPermission] | None:
    required_permissions = options.get(GITHUB_APP_REQUIRED_PERMISSIONS_OPTION)
    if not required_permissions:
        return None

    try:
        expected_permissions = _quantify_github_app_permissions(required_permissions)
        actual_permissions = _quantify_github_app_permissions(metadata.get("permissions", {}))
    except KeyError:
        # If either dict has an unknown permission level, don't enforce anything.
        logger.error(
            "github_permissions.malformed_permissions",
            extra={"required": required_permissions, "actual": metadata.get("permissions")},
        )
        return None

    missing_permissions: list[MissingGithubAppPermission] = []

    for scope, expected_level in expected_permissions.items():
        actual_level = actual_permissions.get(scope)

        if actual_level is None or actual_level < expected_level:
            missing_permissions.append(
                {
                    "expected": {"scope": scope, "level": expected_level},
                    "actual": (
                        {"scope": scope, "level": actual_level}
                        if actual_level is not None
                        else None
                    ),
                }
            )

    return missing_permissions or None


def get_github_permissions_update_url(
    installation_id: str, account_type: str | None, account_login: str
) -> str | None:
    if not installation_id:
        return None
    if account_type == "Organization":
        if not account_login:
            return None
        return (
            f"https://github.com/organizations/{account_login}"
            f"/settings/installations/{installation_id}/permissions/update"
        )
    return f"https://github.com/settings/installations/{installation_id}/permissions/update"
