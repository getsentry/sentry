import pytest

from sentry.integrations.utils.github_permissions import (
    GITHUB_APP_REQUIRED_PERMISSIONS_OPTION,
    get_github_permissions_update_url,
    get_missing_github_app_permissions,
)
from sentry.testutils.helpers.options import override_options


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("required_permissions", "permissions", "expected"),
    [
        (None, {"contents": "read"}, None),
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
    options = (
        {}
        if required_permissions is None
        else {GITHUB_APP_REQUIRED_PERMISSIONS_OPTION: required_permissions}
    )
    with override_options(options):
        assert get_missing_github_app_permissions({"permissions": permissions}) == expected


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
