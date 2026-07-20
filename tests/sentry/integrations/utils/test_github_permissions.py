import pytest

from sentry.integrations.utils.github_permissions import (
    GITHUB_APP_REQUIRED_PERMISSIONS_OPTION,
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
