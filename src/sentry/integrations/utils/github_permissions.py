"""The permissions the current GitHub App version requests, and helpers to
compare an installation against them.

``GITHUB_APP_LATEST_PERMISSIONS`` is the source of truth for what the latest
version of the app asks for; an installation that has not accepted that version
may hold fewer. It lives in the codebase (it used to be the ``github-app.required-permissions``
option) because it is not a secret and has to stay in lockstep with the app's
declared permissions and the tiers in ``github_permission_tiers``. Update it
whenever the app's permissions change.

We only ever compare against it as a floor: an installation holding *more* than
we expect is ignored, since what GitHub reports in the integration metadata
already varies by whether the install is for an org or a single user.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from enum import IntEnum
from typing import Any, NamedTuple, TypedDict

logger = logging.getLogger(__name__)


class PermissionLevel(IntEnum):
    """A level GitHub grants a scope at, ranked weakest to strongest."""

    READ = 1
    WRITE = 2
    ADMIN = 3

    @classmethod
    def parse(cls, level: str) -> PermissionLevel | None:
        """The member ``level`` names, or None if it names none of them."""
        return cls.__members__.get(level.upper())


class GitHubAppPermission(TypedDict):
    scope: str
    level: PermissionLevel


class MissingGithubAppPermission(TypedDict):
    expected: GitHubAppPermission
    actual: GitHubAppPermission | None


class ParsedPermissions(NamedTuple):
    """A scope -> level map as far as we could read it, and what would not read."""

    levels: dict[str, PermissionLevel]
    # The scopes left out of ``levels``, each against a description of what was
    # wrong with it. Already logged by the parse that produced it; callers read
    # this to decide whether a map they cannot fully read is one they can act
    # on at all.
    unreadable: dict[str, str]


# The union of every permission the latest app version's features expect, as scope -> minimum
# level. Each scope is introduced by one of the tiers in github_permission_tiers,
# except the last group, which predates them and is spoken for by BASELINE_TIER:
#   actions:write, code_quality:read, security_events:read  -> PR iteration
#   contents:write                                          -> Autofix pull requests
#   checks:write, statuses:write                            -> Seer code review
#   pull_requests:write                                     -> PR comments
#   administration:read, issues:write, metadata:read,
#   repository_hooks:write                                  -> baseline (earlier features)
GITHUB_APP_LATEST_PERMISSIONS: dict[str, str] = {
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


def parse_github_app_permissions(
    permissions: Mapping[str, object], *, source: str
) -> ParsedPermissions:
    """Read a scope -> level map off the wire, setting aside levels we cannot place.

    ``permissions`` is typed loosely because neither source is checked for us:
    the option is a bare ``Dict`` and the metadata is whatever GitHub last sent.
    A level that is not a string at all is a different mistake from one that is
    a string we do not know -- the first means someone wrote the option wrong,
    the second that GitHub has a level we have not caught up with -- so they are
    logged apart.
    """
    levels: dict[str, PermissionLevel] = {}
    unrecognised: dict[str, str] = {}
    mistyped: dict[str, str] = {}

    for scope, level in permissions.items():
        if not isinstance(level, str):
            mistyped[scope] = f"{type(level).__name__}: {level!r}"
        elif (parsed := PermissionLevel.parse(level)) is None:
            unrecognised[scope] = level
        else:
            levels[scope] = parsed

    if unrecognised or mistyped:
        logger.warning(
            "github_permissions.unreadable_levels",
            extra={
                "source": source,
                "unrecognised_levels": unrecognised,
                "mistyped_levels": mistyped,
            },
        )

    return ParsedPermissions(levels=levels, unreadable={**unrecognised, **mistyped})


def get_missing_github_app_permissions(
    metadata: Mapping[str, Any],
) -> list[MissingGithubAppPermission] | None:
    """The latest permissions the install does not hold.

    None when it holds them all, and also when any level in either map would not
    read: we cannot say what the install holds or what it needs, so we enforce
    nothing rather than report a permission missing that may well be held.
    ``parse_github_app_permissions`` has logged the levels in question.
    """
    expected = parse_github_app_permissions(
        GITHUB_APP_LATEST_PERMISSIONS, source="required_permissions"
    )

    integration_permissions = metadata.get("permissions") or {}
    actual = parse_github_app_permissions(integration_permissions, source="installation")

    if expected.unreadable or actual.unreadable:
        return None

    missing_permissions: list[MissingGithubAppPermission] = []

    for scope, expected_level in expected.levels.items():
        actual_level = actual.levels.get(scope)

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
