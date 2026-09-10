"""The permissions the current GitHub App version requests, and helpers to
compare an installation against them.

``GITHUB_APP_REQUIRED_PERMISSIONS`` is the source of truth for what the app asks
for. It lives in the codebase (it used to be the ``github-app.required-permissions``
option) because it is not a secret and has to stay in lockstep with the app's
declared permissions and the tiers in ``github_permission_tiers``. Update it
whenever the app's required permissions change.

We only ever compare against it as a floor: an installation holding *more* than
we expect is ignored, since what GitHub reports in the integration metadata
already varies by whether the install is for an org or a single user.
"""

import logging
from collections.abc import Mapping
from typing import Any, TypedDict

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

# The union of every permission the app's features expect, as scope -> minimum
# level. Each scope is introduced by one of the tiers in github_permission_tiers,
# except the last group, which predates them and is spoken for by BASELINE_TIER:
#   actions:write, code_quality:read, security_events:read  -> PR iteration
#   contents:write                                          -> Autofix pull requests
#   checks:write, statuses:write                            -> Seer code review
#   pull_requests:write                                     -> PR comments
#   administration:read, issues:write, metadata:read,
#   repository_hooks:write                                  -> baseline (earlier features)
GITHUB_APP_REQUIRED_PERMISSIONS: dict[str, str] = {
    "actions": "write",
    "administration": "read",
    "checks": "write",
    "code_quality": "read",
    "contents": "write",
    "issues": "write",
    "metadata": "read",
    "pull_requests": "write",
    "repository_hooks": "write",
    "security_events": "read",
    "statuses": "write",
}


def _quantify_github_app_permissions(
    permissions: Mapping[str, str],
) -> dict[str, int]:
    return {scope: PERMISSION_LEVELS[level] for scope, level in permissions.items()}


def get_missing_github_app_permissions(
    metadata: Mapping[str, Any],
) -> list[MissingGithubAppPermission] | None:
    try:
        expected_permissions = _quantify_github_app_permissions(GITHUB_APP_REQUIRED_PERMISSIONS)
        actual_permissions = _quantify_github_app_permissions(metadata.get("permissions", {}))
    except KeyError:
        # If either dict has an unknown permission level, don't enforce anything.
        logger.error(
            "github_permissions.malformed_permissions",
            extra={
                "required": GITHUB_APP_REQUIRED_PERMISSIONS,
                "actual": metadata.get("permissions"),
            },
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
