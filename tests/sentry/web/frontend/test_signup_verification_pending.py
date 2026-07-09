from __future__ import annotations

from django.conf import settings
from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.web.frontend.signup_email_verification import PENDING_VERIFICATION_SESSION_KEY

SIGNUP_URL = "https://test.sentry.io/signup/"


@control_silo_test
@override_settings(SENTRY_SIGNUP_URL=SIGNUP_URL)
class SignupVerificationPendingViewTest(TestCase):
    def _get_url(self) -> str:
        return reverse("sentry-signup-verify-email-pending")

    def test_renders_with_session_data(self) -> None:
        session = self.client.session
        session[PENDING_VERIFICATION_SESSION_KEY] = "user@example.com"
        session.save()
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key or ""

        response = self.client.get(self._get_url())

        assert response.status_code == 200
        assert b"user@example.com" in response.content
        assert b"2 hours" in response.content

    def test_redirects_without_session_data(self) -> None:
        response = self.client.get(self._get_url())

        assert response.status_code == 302
        assert response["Location"] == SIGNUP_URL
