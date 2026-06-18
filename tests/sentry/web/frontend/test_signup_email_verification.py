from __future__ import annotations

import time
from typing import Any

from django.conf import settings
from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.signing import sign
from sentry.web.frontend.signup_email_verification import VERIFIED_SESSION_KEY

SIGNUP_URL = "https://test.sentry.io/signup/"


def _make_signed_blob(email: str = "test@example.com", expires_at: float | None = None) -> str:
    if expires_at is None:
        expires_at = time.time() + 3600
    return sign(salt=settings.SIGNUP_VERIFICATION_EMAIL_SALT, email=email, expires_at=expires_at)


@control_silo_test
@override_settings(SENTRY_SIGNUP_URL=SIGNUP_URL)
class SignupEmailVerificationViewTest(TestCase):
    def _get_path(self, signed_data: str) -> str:
        return reverse("sentry-signup-verify-email", args=[signed_data])

    def _get_with_session(self, email: str = "test@example.com", **blob_kwargs: Any) -> Any:
        session = self.client.session
        session["pending_signup_verification_email"] = email
        session.save()
        assert session.session_key is not None
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key

        signed = _make_signed_blob(email=email, **blob_kwargs)

        return self.client.get(self._get_path(signed))

    def test_expired_link_renders_error_page(self) -> None:
        resp = self._get_with_session(expires_at=time.time() - 1)
        assert resp.status_code == 400
        assert "Link expired" in resp.content.decode()

    def test_tampered_signature_renders_error_page(self) -> None:
        resp = self.client.get(self._get_path("totally-bogus-data"))
        assert resp.status_code == 400
        assert "Verification error" in resp.content.decode()

    def test_email_mismatch_renders_error_page(self) -> None:
        session = self.client.session
        session["pending_signup_verification_email"] = "other@example.com"
        session.save()
        assert session.session_key is not None
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key

        resp = self.client.get(self._get_path(_make_signed_blob(email="attacker@example.com")))
        assert resp.status_code == 400

    def test_no_pending_email_in_session_renders_error_page(self) -> None:
        resp = self.client.get(self._get_path(_make_signed_blob()))
        assert resp.status_code == 400

    def test_valid_link_sets_verified_email_in_session(self) -> None:
        resp = self._get_with_session(email="user@example.com")
        assert resp.status_code == 302
        assert self.client.session[VERIFIED_SESSION_KEY] == "user@example.com"
