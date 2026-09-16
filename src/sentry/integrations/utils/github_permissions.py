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

from __future__ import annotations

import logging
from collections.abc import Mapping
from enum import IntEnum
from typing import Any, NamedTuple, TypedDict

from sentry import options

logger = logging.getLogger(__name__)

GITHUB_APP_REQUIRED_PERMISSIONS_OPTION = "github-app.required-permissions"


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


def has_github_app_permissions(
    permissions: Mapping[str, object], required_permissions: Mapping[str, PermissionLevel]
) -> bool:
    parsed = parse_github_app_permissions(permissions, source="installation")
    return not parsed.unreadable and all(
        parsed.levels.get(scope, 0) >= level for scope, level in required_permissions.items()
    )


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
    """The required permissions the install does not hold.

    None when it holds them all, and also when any level in either map would not
    read: we cannot say what the install holds or what it needs, so we enforce
    nothing rather than report a permission missing that may well be held.
    ``parse_github_app_permissions`` has logged the levels in question.
    """
    required_permissions = options.get(GITHUB_APP_REQUIRED_PERMISSIONS_OPTION)
    if not required_permissions:
        return None

    expected = parse_github_app_permissions(
        required_permissions, source="required_permissions_option"
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
