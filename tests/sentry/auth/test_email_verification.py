import time
from unittest import mock

import pytest
from django.core.signing import BadSignature, SignatureExpired
from django.test import RequestFactory

from sentry.auth.email_verification import (
    _format_expiry,
    send_signup_verification_email,
    unsign_signup_verification,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.signing import sign

TEST_SALT = "test-salt"


@control_silo_test
class SendSignupVerificationEmailTest(TestCase):
    def setUp(self):
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
    def test_sends_verification_email(self, mock_builder, mock_reverse):
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
    def test_signed_blob_contains_payload(self, mock_builder, mock_reverse):
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
    def test_creates_session_if_missing(self, mock_builder, mock_reverse):
        mock_builder.return_value = mock.MagicMock()
        request = self.factory.get("/")
        session = mock.MagicMock()
        session.session_key = None
        request.session = session

        send_signup_verification_email(request, "test@example.com")

        session.create.assert_called_once()


@control_silo_test
class UnsignSignupVerificationTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.request = self.factory.get("/")
        session = mock.MagicMock()
        session.session_key = "s1"
        self.request.session = session

    @mock.patch("sentry.auth.email_verification._get_salt", return_value=TEST_SALT)
    def test_valid_signature(self, mock_salt):
        exp = time.time() + 300
        signed = sign(salt=TEST_SALT, email="a@b.com", session_id="s1", expires_at=exp)
        result = unsign_signup_verification(signed, self.request)
        assert result["email"] == "a@b.com"
        assert result["session_id"] == "s1"

    @mock.patch("sentry.auth.email_verification._get_salt", return_value=TEST_SALT)
    def test_expired_link(self, mock_salt):
        exp = time.time() - 1
        signed = sign(salt=TEST_SALT, email="a@b.com", session_id="s1", expires_at=exp)
        with pytest.raises(SignatureExpired):
            unsign_signup_verification(signed, self.request)

    @mock.patch("sentry.auth.email_verification._get_salt", return_value=TEST_SALT)
    def test_tampered_signature(self, mock_salt):
        exp = time.time() + 300
        signed = sign(salt=TEST_SALT, email="a@b.com", session_id="s1", expires_at=exp)
        with pytest.raises(BadSignature):
            unsign_signup_verification(signed + "x", self.request)

    @mock.patch("sentry.auth.email_verification._get_salt", return_value=TEST_SALT)
    def test_wrong_salt(self, mock_salt):
        exp = time.time() + 300
        signed = sign(salt="wrong-salt", email="a@b.com", session_id="s1", expires_at=exp)
        with pytest.raises(BadSignature):
            unsign_signup_verification(signed, self.request)

    @mock.patch("sentry.auth.email_verification._get_salt", return_value=TEST_SALT)
    def test_session_mismatch(self, mock_salt):
        exp = time.time() + 300
        signed = sign(salt=TEST_SALT, email="a@b.com", session_id="else", expires_at=exp)
        with pytest.raises(ValueError, match="Session mismatch"):
            unsign_signup_verification(signed, self.request)


class FormatExpiryTest(TestCase):
    def test_hours(self):
        assert _format_expiry(60) == "1 hour"
        assert _format_expiry(120) == "2 hours"

    def test_minutes(self):
        assert _format_expiry(1) == "1 minute"
        assert _format_expiry(10) == "10 minutes"

    def test_non_round_hours(self):
        assert _format_expiry(90) == "90 minutes"
