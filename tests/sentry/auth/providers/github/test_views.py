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
    def _run(
        self,
        *,
        user: dict,
        emails: list[dict] | None = None,
        emails_error: Exception | None = None,
    ) -> dict:
        pipeline = mock.MagicMock()
        pipeline.fetch_state.return_value = {"access_token": "tok"}

        client = mock.MagicMock()
        client.__enter__.return_value = client
        client.get_user.return_value = user
        if emails_error is not None:
            client.get_user_emails.side_effect = emails_error
        else:
            client.get_user_emails.return_value = emails

        with mock.patch("sentry.auth.providers.github.views.GitHubClient", return_value=client):
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
