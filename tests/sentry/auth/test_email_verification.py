import time
from unittest import mock

import pytest
from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired

from sentry.auth.email_verification import (
    send_signup_verification_email,
    verify_signup_link,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.signing import sign

SALT = settings.SIGNUP_VERIFICATION_EMAIL_SALT


@control_silo_test
class SendSignupVerificationEmailTest(TestCase):
    @mock.patch(
        "sentry.auth.email_verification.reverse",
        return_value="/auth/signup/verify-email/fakeblob/",
    )
    @mock.patch("sentry.auth.email_verification.MessageBuilder")
    def test_sends_verification_email(
        self, mock_builder: mock.MagicMock, mock_reverse: mock.MagicMock
    ) -> None:
        mock_msg = mock.MagicMock()
        mock_builder.return_value = mock_msg

        send_signup_verification_email("test@example.com", max_age_minutes=10)

        context = mock_builder.call_args[1]["context"]
        assert context["confirm_email"] == "test@example.com"
        assert context["is_new_user"] is True
        assert context["expiry_text"] == "10 minutes"
        mock_msg.send_async.assert_called_once_with(["test@example.com"])

    @mock.patch(
        "sentry.auth.email_verification.reverse",
        return_value="/auth/signup/verify-email/fakeblob/",
    )
    @mock.patch("sentry.auth.email_verification.MessageBuilder")
    def test_signed_blob_contains_payload(
        self, mock_builder: mock.MagicMock, mock_reverse: mock.MagicMock
    ) -> None:
        mock_builder.return_value = mock.MagicMock()

        send_signup_verification_email("user@example.com")

        signed_blob = mock_reverse.call_args[1]["args"][0]
        payload = verify_signup_link(signed_blob)
        assert payload["email"] == "user@example.com"
        assert payload["expires_at"] > time.time()


@control_silo_test
class UnsignSignupVerificationTest(TestCase):
    def test_valid_signature(self) -> None:
        exp = time.time() + 300
        signed = sign(salt=SALT, email="a@b.com", expires_at=exp)
        result = verify_signup_link(signed)
        assert result["email"] == "a@b.com"
        assert result["expires_at"] == exp

    def test_expired_link(self) -> None:
        exp = time.time() - 1
        signed = sign(salt=SALT, email="a@b.com", expires_at=exp)
        with pytest.raises(SignatureExpired):
            verify_signup_link(signed)

    def test_tampered_signature(self) -> None:
        exp = time.time() + 300
        signed = sign(salt=SALT, email="a@b.com", expires_at=exp)
        tampered = signed[:-1] + ("A" if signed[-1] != "A" else "B")
        with pytest.raises(BadSignature):
            verify_signup_link(tampered)

    def test_malformed_link_throws_bad_sig(self) -> None:
        with pytest.raises(BadSignature):
            verify_signup_link("not-valid-base64-!!!")

    def test_wrong_salt(self) -> None:
        exp = time.time() + 300
        signed = sign(salt="wrong-salt", email="a@b.com", expires_at=exp)
        with pytest.raises(BadSignature):
            verify_signup_link(signed)
