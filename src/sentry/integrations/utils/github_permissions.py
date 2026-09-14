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
from typing import Any, TypedDict

from sentry import options

logger = logging.getLogger(__name__)

GITHUB_APP_REQUIRED_PERMISSIONS_OPTION = "github-app.required-permissions"


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


def has_github_app_permissions(
    metadata: Mapping[str, Any], required_permissions: Mapping[str, str]
) -> bool:
    permissions = metadata.get("permissions")
    if not isinstance(permissions, Mapping):
        return False

    try:
        return not _get_missing_github_app_permissions(permissions, required_permissions)
    except KeyError:
        return False


def get_missing_github_app_permissions(
    metadata: Mapping[str, Any],
) -> list[MissingGithubAppPermission] | None:
    required_permissions = options.get(GITHUB_APP_REQUIRED_PERMISSIONS_OPTION)
    if not required_permissions:
        return None

    actual_permissions = metadata.get("permissions")
    if not isinstance(required_permissions, Mapping) or not isinstance(actual_permissions, Mapping):
        logger.error(
            "github_permissions.malformed_permissions",
            extra={"required": required_permissions, "actual": actual_permissions},
        )
        return None

    try:
        missing_permissions = _get_missing_github_app_permissions(
            actual_permissions, required_permissions
        )
    except KeyError:
        # If either dict has an unknown permission level, don't enforce anything.
        logger.error(
            "github_permissions.malformed_permissions",
            extra={"required": required_permissions, "actual": metadata.get("permissions")},
        )
        return None

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


def _get_missing_github_app_permissions(
    actual_permissions: Mapping[str, str], required_permissions: Mapping[str, str]
) -> list[MissingGithubAppPermission]:
    required = _quantify_github_app_permissions(required_permissions)
    actual = _quantify_github_app_permissions(actual_permissions)

    missing_permissions: list[MissingGithubAppPermission] = []
    for scope, required_level in required.items():
        actual_level = actual.get(scope)
        if actual_level is None or actual_level < required_level:
            missing_permissions.append(
                {
                    "expected": {"scope": scope, "level": required_level},
                    "actual": (
                        {"scope": scope, "level": actual_level}
                        if actual_level is not None
                        else None
                    ),
                }
            )
    return missing_permissions


def _quantify_github_app_permissions(
    permissions: Mapping[str, str],
) -> dict[str, int]:
    return {scope: PERMISSION_LEVELS[level] for scope, level in permissions.items()}
