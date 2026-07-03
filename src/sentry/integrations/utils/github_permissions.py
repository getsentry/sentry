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
