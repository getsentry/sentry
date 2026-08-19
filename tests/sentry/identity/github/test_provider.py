from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import responses
from django.test import override_settings

from sentry.conf.server import DEAD
from sentry.identity.github.provider import (
    GitHubIdentityProvider,
    fetch_verified_primary_email,
    get_verified_primary_email,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

EMAILS_URL = "https://api.github.com/user/emails"


@control_silo_test
class FetchVerifiedPrimaryEmailTest(TestCase):
    @responses.activate
    def test_fetches_and_delegates_to_filter(self) -> None:
        records = [{"email": "primary@example.com", "verified": True, "primary": True}]
        responses.add(responses.GET, EMAILS_URL, json=records)
        with patch(
            "sentry.identity.github.provider.get_verified_primary_email",
            return_value="chosen@example.com",
        ) as mock_filter:
            assert fetch_verified_primary_email("token") == "chosen@example.com"
        mock_filter.assert_called_once_with(records)

    @responses.activate
    def test_http_error_returns_none(self) -> None:
        responses.add(responses.GET, EMAILS_URL, status=401)
        assert fetch_verified_primary_email("token") is None

    @responses.activate
    def test_unexpected_shape_returns_none(self) -> None:
        responses.add(responses.GET, EMAILS_URL, json={"message": "Not Found"})
        assert fetch_verified_primary_email("token") is None


@pytest.mark.parametrize(
    "emails,expected",
    [
        pytest.param(
            [{"email": "p@example.com", "verified": True, "primary": True}],
            "p@example.com",
            id="verified-primary",
        ),
        pytest.param(
            [
                {"email": "secondary@example.com", "verified": True, "primary": False},
                {"email": "primary@example.com", "verified": True, "primary": True},
            ],
            "primary@example.com",
            id="picks-verified-primary-among-many",
        ),
        pytest.param(
            [{"email": "p@example.com", "verified": False, "primary": True}],
            None,
            id="unverified-primary",
        ),
        pytest.param(
            [{"email": "v@example.com", "verified": True, "primary": False}],
            None,
            id="verified-not-primary",
        ),
        pytest.param([], None, id="empty"),
        pytest.param([{"verified": True, "primary": True}], None, id="missing-email-field"),
        pytest.param(
            ["not-a-dict", {"email": "p@example.com", "verified": True, "primary": True}],
            "p@example.com",
            id="skips-malformed-records",
        ),
    ],
)
def test_get_verified_primary_email(emails: list, expected: str | None) -> None:
    assert get_verified_primary_email(emails) == expected


def test_github_oauth_client_secret_uses_single_organization_setting() -> None:
    with override_settings(
        SENTRY_SINGLE_ORGANIZATION=True,
        GITHUB_API_SECRET="single-organization-secret",
        SENTRY_GITHUB_APP_CLIENT_SECRET=DEAD,
    ):
        assert GitHubIdentityProvider().get_oauth_client_secret() == "single-organization-secret"


def test_github_oauth_client_secret_returns_none_when_unconfigured() -> None:
    with override_settings(
        SENTRY_SINGLE_ORGANIZATION=False,
        SENTRY_GITHUB_APP_CLIENT_SECRET=DEAD,
    ):
        assert GitHubIdentityProvider().get_oauth_client_secret() is None


@control_silo_test
class GitHubIdentityProviderBuildIdentityTest(TestCase):
    @patch("sentry.identity.github.provider.get_user_info")
    def test_email_verified_is_never_trusted(self, mock_get_user_info: MagicMock) -> None:
        # The GitHub App identity has no user scopes and cannot confirm verification, so a
        # present email must not be reported as verified.
        mock_get_user_info.return_value = {
            "id": 42,
            "email": "user@example.com",
            "login": "octocat",
            "name": "Octo Cat",
            "company": "@github",
        }

        identity = GitHubIdentityProvider().build_identity({"data": {"access_token": "token"}})

        assert identity["email"] == "user@example.com"
        assert identity["email_verified"] is False
