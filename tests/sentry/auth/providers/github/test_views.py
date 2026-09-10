from unittest import mock

import pytest

from sentry.auth.providers.github.client import GitHubApiError
from sentry.auth.providers.github.views import FetchUser, _get_name_from_email
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

expected_data = [
    ("john.smith@example.com", "John Smith"),
    ("john@example.com", "John"),
    ("XYZ-234=3523@example.com", "Xyz-234=3523"),
    ("XYZ.1111@example.com", "Xyz 1111"),
    ("JOHN@example.com", "John"),
]


@pytest.mark.parametrize("email,expected_name", expected_data)
def test_get_name_from_email(email, expected_name) -> None:
    assert _get_name_from_email(email) == expected_name


@control_silo_test
class FetchUserTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.auth_provider = self.create_auth_provider(
            organization_id=self.organization.id, provider="github"
        )

        self.github_client = mock.MagicMock()
        self.github_client.__enter__.return_value = self.github_client

    def _run(
        self,
        *,
        user: dict,
        emails: list[dict] | None = None,
        emails_error: Exception | None = None,
        returning_user: bool = False,
        returning_user_active: bool = True,
    ) -> dict:
        if returning_user:
            identity_user = (
                self.user if returning_user_active else self.create_user(is_active=False)
            )
            self.create_auth_identity(
                user=identity_user, auth_provider=self.auth_provider, ident=user["id"]
            )

        pipeline = mock.MagicMock()
        pipeline.fetch_state.return_value = {"access_token": "tok"}
        pipeline.provider_model = self.auth_provider

        self.github_client.get_user.return_value = user
        if emails_error is not None:
            self.github_client.get_user_emails.side_effect = emails_error
        else:
            self.github_client.get_user_emails.return_value = emails

        with mock.patch(
            "sentry.auth.providers.github.views.GitHubClient", return_value=self.github_client
        ):
            FetchUser(org=None).handle(mock.MagicMock(), pipeline)

        key, bound_user = pipeline.bind_state.call_args.args
        assert key == "user"
        return bound_user

    def test_verified_primary_sets_email_verified(self) -> None:
        bound_user = self._run(
            user={"id": 1, "email": "profile@example.com", "name": "n"},
            emails=[{"email": "verified@example.com", "verified": True, "primary": True}],
        )
        assert bound_user["email"] == "verified@example.com"
        assert bound_user["email_verified"] is True

    def test_no_verified_primary_leaves_email_verified_unset(self) -> None:
        bound_user = self._run(
            user={"id": 1, "email": "profile@example.com", "name": "n"},
            emails=[{"email": "unverified@example.com", "verified": False, "primary": True}],
        )
        assert bound_user["email"] == "profile@example.com"
        assert "email_verified" not in bound_user

    def test_email_fetch_api_error_does_not_block_login(self) -> None:
        bound_user = self._run(
            user={"id": 1, "email": "profile@example.com", "name": "n"},
            emails_error=GitHubApiError("boom", status=500),
        )
        assert bound_user["email"] == "profile@example.com"
        assert "email_verified" not in bound_user

    def test_email_fetch_json_error_does_not_block_login(self) -> None:
        bound_user = self._run(
            user={"id": 1, "email": "profile@example.com", "name": "n"},
            emails_error=ValueError("bad json"),
        )
        assert bound_user["email"] == "profile@example.com"
        assert "email_verified" not in bound_user

    def test_malformed_emails_response_does_not_crash(self) -> None:
        # get_user_emails wraps a non-list 2xx body into [dict]; the fallback must not
        # KeyError on a record lacking "primary"/"email".
        pipeline = mock.MagicMock()
        pipeline.fetch_state.return_value = {"access_token": "tok"}
        pipeline.provider_model = self.auth_provider
        client = mock.MagicMock()
        client.__enter__.return_value = client
        client.get_user.return_value = {"id": 1, "name": "n"}  # no public email -> fallback
        client.get_user_emails.return_value = [{"message": "boom"}]  # malformed shape

        with (
            mock.patch("sentry.auth.providers.github.views.REQUIRE_VERIFIED_EMAIL", False),
            mock.patch("sentry.auth.providers.github.views.GitHubClient", return_value=client),
        ):
            FetchUser(org=None).handle(mock.MagicMock(), pipeline)

        pipeline.error.assert_called_once()  # graceful ERR_NO_PRIMARY_EMAIL, not KeyError

    def test_returning_active_user_without_public_email_still_falls_back(self) -> None:
        # SSO IdPs guarantee email/name on every login regardless of new-vs-returning
        bound_user = self._run(
            user={"id": 1, "name": "n"},  # no public email
            emails=[{"email": "hidden@example.com", "verified": False, "primary": True}],
            returning_user=True,
        )
        assert bound_user["email"] == "hidden@example.com"
        assert "email_verified" not in bound_user
        self.github_client.get_user_emails.assert_called_once()

    def test_returning_active_user_without_public_email_prefers_verified_primary(self) -> None:
        bound_user = self._run(
            user={"id": 1, "name": "n"},  # no public email
            emails=[{"email": "verified@example.com", "verified": True, "primary": True}],
            returning_user=True,
        )
        assert bound_user["email"] == "verified@example.com"
        assert bound_user["email_verified"] is True

    def test_returning_active_user_with_public_email_skips_email_fetch(self) -> None:
        bound_user = self._run(
            user={"id": 1, "email": "profile@example.com", "name": "n"},
            returning_user=True,
        )
        assert bound_user["email"] == "profile@example.com"
        assert "email_verified" not in bound_user
        self.github_client.get_user_emails.assert_not_called()

    def test_returning_active_user_without_name_still_derives_one(self) -> None:
        bound_user = self._run(
            user={"id": 1, "email": "profile@example.com"},  # no name
            returning_user=True,
        )
        assert bound_user["name"] == "Profile"

    def test_returning_inactive_user_still_requires_email(self) -> None:
        # An inactive matched identity falls through to handle_unknown_identity,
        # which resolves by email - so the full email fetch/validation still applies.
        bound_user = self._run(
            user={"id": 1, "name": "n"},
            emails=[{"email": "hidden@example.com", "verified": False, "primary": True}],
            returning_user=True,
            returning_user_active=False,
        )
        assert bound_user["email"] == "hidden@example.com"
        assert "email_verified" not in bound_user
        self.github_client.get_user_emails.assert_called_once()
