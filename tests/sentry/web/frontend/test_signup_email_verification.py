from __future__ import annotations

import time
from typing import Any
from unittest import mock

from django.conf import settings
from django.http import HttpRequest
from django.http.response import HttpResponseBase
from django.test import override_settings
from django.urls import path, reverse

from sentry.analytics.events.signup_email_verification import SignupEmailVerificationClickedEvent
from sentry.auth.email_verification import hash_email
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.silo import control_silo_test
from sentry.utils.signing import sign
from sentry.web.frontend.base import control_silo_view
from sentry.web.frontend.signup_email_verification import BaseSignupVerificationView

SIGNUP_URL = "https://test.sentry.io/signup/"


@control_silo_view
class _TestVerificationView(BaseSignupVerificationView):
    def handle_verified_email(self, request: HttpRequest, email: str) -> HttpResponseBase:
        return self.redirect(SIGNUP_URL)


# Wire up two test URLs, under different names, both served by the same view class.
# signup_method is derived from request.resolver_match.url_name, so hitting each one
# should produce a different signup_method — that's what distinguishes it from a
# hardcoded class attribute.
urlpatterns = [
    path(
        "auth/signup/verify-email/test/<signed_data>/",
        _TestVerificationView.as_view(),
        name="test-signup-verify-email",
    ),
    path(
        "auth/signup/verify-email/test-alt/<signed_data>/",
        _TestVerificationView.as_view(),
        name="test-signup-verify-email-alt",
    ),
]


def _make_signed_blob(email: str = "test@example.com", expires_at: float | None = None) -> str:
    if expires_at is None:
        expires_at = time.time() + 3600
    return sign(salt=settings.SIGNUP_VERIFICATION_EMAIL_SALT, email=email, expires_at=expires_at)


@control_silo_test
@override_settings(
    SENTRY_SIGNUP_URL=SIGNUP_URL,
    ROOT_URLCONF="tests.sentry.web.frontend.test_signup_email_verification",
)
class BaseSignupVerificationViewTest(TestCase):
    def _get_path(self, signed_data: str, url_name: str = "test-signup-verify-email") -> str:
        return reverse(url_name, args=[signed_data])

    def _get_with_session(
        self,
        email: str = "test@example.com",
        url_name: str = "test-signup-verify-email",
        **blob_kwargs: Any,
    ) -> Any:
        session = self.client.session
        session["pending_signup_verification_email"] = email
        session.save()
        assert session.session_key is not None
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key

        signed = _make_signed_blob(email=email, **blob_kwargs)

        return self.client.get(self._get_path(signed, url_name=url_name))

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

    def test_valid_link_redirects(self) -> None:
        resp = self._get_with_session(email="user@example.com")
        assert resp.status_code == 302

    @mock.patch("sentry.analytics.record")
    def test_signup_method_reflects_resolved_url_name(self, mock_record: mock.MagicMock) -> None:
        resp = self._get_with_session(email="user@example.com", url_name="test-signup-verify-email")
        assert resp.status_code == 302
        assert_last_analytics_event(
            mock_record,
            SignupEmailVerificationClickedEvent(
                email_hash=hash_email("user@example.com"),
                outcome="success",
                signup_method="test-signup-verify-email",
            ),
        )

        resp = self._get_with_session(
            email="other-user@example.com", url_name="test-signup-verify-email-alt"
        )
        assert resp.status_code == 302
        assert_last_analytics_event(
            mock_record,
            SignupEmailVerificationClickedEvent(
                email_hash=hash_email("other-user@example.com"),
                outcome="success",
                signup_method="test-signup-verify-email-alt",
            ),
        )
