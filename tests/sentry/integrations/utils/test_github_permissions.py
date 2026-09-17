from unittest import mock

import pytest

from sentry.integrations.utils.github_permissions import (
    PermissionLevel,
    get_github_permissions_update_url,
    get_missing_github_app_permissions,
    parse_github_app_permissions,
)


@pytest.mark.parametrize(
    ("required_permissions", "permissions", "expected"),
    [
        ({}, {"contents": "read"}, None),
        (
            {"contents": "read", "pull_requests": "write"},
            {"contents": "read", "pull_requests": "write"},
            None,
        ),
        (
            {"contents": "read", "pull_requests": "write"},
            {"contents": "admin", "pull_requests": "admin"},
            None,
        ),
        (
            {"contents": "write"},
            {},
            [{"expected": {"scope": "contents", "level": 2}, "actual": None}],
        ),
        (
            # An install whose metadata has no permissions recorded at all.
            {"contents": "write"},
            None,
            [{"expected": {"scope": "contents", "level": 2}, "actual": None}],
        ),
        (
            {"contents": "write"},
            {"contents": "read"},
            [
                {
                    "expected": {"scope": "contents", "level": 2},
                    "actual": {"scope": "contents", "level": 1},
                }
            ],
        ),
        (
            {"contents": "admin", "pull_requests": "write", "issues": "read"},
            {"contents": "write", "pull_requests": "write", "issues": "read"},
            [
                {
                    "expected": {"scope": "contents", "level": 3},
                    "actual": {"scope": "contents", "level": 2},
                }
            ],
        ),
    ],
)
def test_get_missing_github_app_permissions(required_permissions, permissions, expected) -> None:
    with mock.patch.dict(
        "sentry.integrations.utils.github_permissions.GITHUB_APP_LATEST_PERMISSIONS",
        required_permissions,
        clear=True,
    ):
        assert get_missing_github_app_permissions({"permissions": permissions}) == expected


def test_levels_are_ordered_weakest_to_strongest() -> None:
    assert PermissionLevel.READ < PermissionLevel.WRITE < PermissionLevel.ADMIN


@pytest.mark.parametrize(
    ("level", "expected"),
    [
        ("read", PermissionLevel.READ),
        ("write", PermissionLevel.WRITE),
        ("admin", PermissionLevel.ADMIN),
        ("wrtie", None),
        ("", None),
    ],
)
def test_parsing_a_level(level, expected) -> None:
    assert PermissionLevel.parse(level) is expected


@mock.patch("sentry.integrations.utils.github_permissions.logger.warning")
def test_parse_reads_the_levels_it_knows(mock_warning) -> None:
    parsed = parse_github_app_permissions(
        {"contents": "read", "issues": "write", "actions": "admin"}, source="installation"
    )

    assert parsed.levels == {
        "contents": PermissionLevel.READ,
        "issues": PermissionLevel.WRITE,
        "actions": PermissionLevel.ADMIN,
    }
    assert parsed.unreadable == {}
    mock_warning.assert_not_called()


@mock.patch("sentry.integrations.utils.github_permissions.logger.warning")
def test_parse_sets_aside_a_level_it_does_not_know(mock_warning) -> None:
    parsed = parse_github_app_permissions(
        {"contents": "write", "issues": "wrtie"}, source="installation"
    )

    assert parsed.levels == {"contents": PermissionLevel.WRITE}
    assert parsed.unreadable == {"issues": "wrtie"}


@mock.patch("sentry.integrations.utils.github_permissions.logger.warning")
def test_parse_reports_a_level_of_the_wrong_type_apart(mock_warning) -> None:
    """A level that is not a string is someone writing the constant wrong."""
    parsed = parse_github_app_permissions(
        {"contents": 2, "issues": None, "actions": "wrtie"}, source="required_permissions"
    )

    assert parsed.levels == {}
    assert parsed.unreadable == {
        "contents": "int: 2",
        "issues": "NoneType: None",
        "actions": "wrtie",
    }


@mock.patch("sentry.integrations.utils.github_permissions.logger.warning")
def test_an_unreadable_required_level_stops_enforcing_anything(mock_warning) -> None:
    """One level we cannot place means we do not trust the comparison at all."""
    required = {"contents": "wrtie", "issues": "write"}

    with mock.patch.dict(
        "sentry.integrations.utils.github_permissions.GITHUB_APP_LATEST_PERMISSIONS",
        required,
        clear=True,
    ):
        assert get_missing_github_app_permissions({"permissions": {"contents": "read"}}) is None


@mock.patch("sentry.integrations.utils.github_permissions.logger.warning")
def test_an_unreadable_held_level_stops_enforcing_anything(mock_warning) -> None:
    with mock.patch.dict(
        "sentry.integrations.utils.github_permissions.GITHUB_APP_LATEST_PERMISSIONS",
        {"contents": "write"},
        clear=True,
    ):
        assert get_missing_github_app_permissions({"permissions": {"contents": "wrtie"}}) is None


@mock.patch("sentry.integrations.utils.github_permissions.logger.warning")
def test_a_mistyped_required_level_stops_enforcing_rather_than_raising(mock_warning) -> None:
    """A non-string required level is a mistake in the codebase constant."""
    with mock.patch.dict(
        "sentry.integrations.utils.github_permissions.GITHUB_APP_LATEST_PERMISSIONS",
        {"contents": 2},
        clear=True,
    ):
        assert get_missing_github_app_permissions({"permissions": {"contents": "read"}}) is None


@pytest.mark.parametrize(
    ("installation_id", "account_type", "account_login", "expected"),
    [
        (
            "123",
            "User",
            "example-user",
            "https://github.com/settings/installations/123/permissions/update",
        ),
        (
            "123",
            "Organization",
            "example-org",
            "https://github.com/organizations/example-org"
            "/settings/installations/123/permissions/update",
        ),
        (
            "123",
            None,
            "example-user",
            "https://github.com/settings/installations/123/permissions/update",
        ),
        ("123", "Organization", "", None),
        ("", "User", "example-user", None),
    ],
)
def test_get_github_permissions_update_url(
    installation_id, account_type, account_login, expected
) -> None:
    assert (
        get_github_permissions_update_url(installation_id, account_type, account_login) == expected
    )
