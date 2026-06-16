import time
from unittest import mock

import pytest
from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired
from django.test import RequestFactory

from sentry.auth.email_verification import (
    send_signup_verification_email,
    unsign_signup_verification,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.signing import sign

SALT = settings.SIGNUP_VERIFICATION_EMAIL_SALT


@control_silo_test
class SendSignupVerificationEmailTest(TestCase):
    def setUp(self) -> None:
        self.factory = RequestFactory()
        self.request = self.factory.get("/")
        session = mock.MagicMock()
        session.session_key = "test-session-key"
        self.request.session = session

    @mock.patch(
        "sentry.auth.email_verification.reverse",
        return_value="/api/0/signup/verify-email/fakeblob/",
    )
    @mock.patch("sentry.auth.email_verification.MessageBuilder")
    def test_sends_verification_email(
        self, mock_builder: mock.MagicMock, mock_reverse: mock.MagicMock
    ) -> None:
        mock_msg = mock.MagicMock()
        mock_builder.return_value = mock_msg

        send_signup_verification_email(self.request, "test@example.com", max_age_minutes=10)

        context = mock_builder.call_args[1]["context"]
        assert context["confirm_email"] == "test@example.com"
        assert context["is_new_user"] is True
        assert context["expiry_text"] == "10 minutes"
        mock_msg.send_async.assert_called_once_with(["test@example.com"])

    @mock.patch(
        "sentry.auth.email_verification.reverse",
        return_value="/api/0/signup/verify-email/fakeblob/",
    )
    @mock.patch("sentry.auth.email_verification.MessageBuilder")
    def test_signed_blob_contains_payload(
        self, mock_builder: mock.MagicMock, mock_reverse: mock.MagicMock
    ) -> None:
        mock_builder.return_value = mock.MagicMock()

        send_signup_verification_email(self.request, "user@example.com")

        signed_blob = mock_reverse.call_args[1]["args"][0]
        payload = unsign_signup_verification(signed_blob, self.request)
        assert payload["email"] == "user@example.com"
        assert payload["session_id"] == "test-session-key"
        assert payload["expires_at"] > time.time()

    @mock.patch(
        "sentry.auth.email_verification.reverse",
        return_value="/api/0/signup/verify-email/fakeblob/",
    )
    @mock.patch("sentry.auth.email_verification.MessageBuilder")
    def test_creates_session_if_missing(
        self, mock_builder: mock.MagicMock, mock_reverse: mock.MagicMock
    ) -> None:
        mock_builder.return_value = mock.MagicMock()
        request = self.factory.get("/")
        session = mock.MagicMock()
        session.session_key = None
        request.session = session

        send_signup_verification_email(request, "test@example.com")

        session.create.assert_called_once()


@control_silo_test
class UnsignSignupVerificationTest(TestCase):
    def setUp(self) -> None:
        self.factory = RequestFactory()
        self.request = self.factory.get("/")
        session = mock.MagicMock()
        session.session_key = "s1"
        self.request.session = session

    def test_valid_signature(self) -> None:
        exp = time.time() + 300
        signed = sign(salt=SALT, email="a@b.com", session_id="s1", expires_at=exp)
        result = unsign_signup_verification(signed, self.request)
        assert result["email"] == "a@b.com"
        assert result["session_id"] == "s1"

    def test_expired_link(self) -> None:
        exp = time.time() - 1
        signed = sign(salt=SALT, email="a@b.com", session_id="s1", expires_at=exp)
        with pytest.raises(SignatureExpired):
            unsign_signup_verification(signed, self.request)

    def test_tampered_signature(self) -> None:
        exp = time.time() + 300
        signed = sign(salt=SALT, email="a@b.com", session_id="s1", expires_at=exp)
        tampered = signed[:-1] + ("A" if signed[-1] != "A" else "B")
        with pytest.raises(BadSignature):
            unsign_signup_verification(tampered, self.request)

    def test_malformed_link_throws_bad_sig(self) -> None:
        with pytest.raises(BadSignature):
            unsign_signup_verification("not-valid-base64-!!!", self.request)

    def test_wrong_salt(self) -> None:
        exp = time.time() + 300
        signed = sign(salt="wrong-salt", email="a@b.com", session_id="s1", expires_at=exp)
        with pytest.raises(BadSignature):
            unsign_signup_verification(signed, self.request)

    def test_session_mismatch(self) -> None:
        exp = time.time() + 300
        signed = sign(salt=SALT, email="a@b.com", session_id="else", expires_at=exp)
        with pytest.raises(ValueError, match="Session mismatch"):
            unsign_signup_verification(signed, self.request)
