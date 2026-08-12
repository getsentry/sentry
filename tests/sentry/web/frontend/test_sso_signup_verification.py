from __future__ import annotations

import time
from typing import Any
from unittest import mock

from django.conf import settings
from django.urls import reverse

from sentry.auth.store import FLOW_LOGIN
from sentry.models.authidentity import AuthIdentity
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail
from sentry.utils import json
from sentry.utils.hashlib import md5_text
from sentry.utils.redis import clusters
from sentry.utils.signing import sign
from sentry.web.frontend.signup_email_verification import PENDING_VERIFICATION_SESSION_KEY

REDIS_CLUSTER = "default"
DUMMY_PIPELINE_SIGNATURE = md5_text("sentry.auth.providers.dummy.AskEmail").hexdigest()


def _make_signed_blob(email: str, expires_at: float | None = None) -> str:
    if expires_at is None:
        expires_at = time.time() + 3600
    return sign(salt=settings.SIGNUP_VERIFICATION_EMAIL_SALT, email=email, expires_at=expires_at)


@control_silo_test
class SSOSignupVerificationViewTest(TestCase):
    endpoint = "sentry-signup-verify-email-sso"

    def setUp(self) -> None:
        super().setUp()
        self.email = "newuser@example.com"
        self.auth_provider_inst = self.create_auth_provider(
            organization_id=self.organization.id, provider="dummy"
        )

    def _setup_pipeline(self) -> None:
        """Write SSO pipeline state directly to Redis and reference it from the session."""
        auth_key = "auth:pipeline:test-sso-verification"

        pipeline_state = {
            "org_id": self.organization.id,
            "flow": FLOW_LOGIN,
            "provider_model_id": self.auth_provider_inst.id,
            "provider_key": "dummy",
            "referrer": None,
            "uid": None,
            "step_index": 1,
            "signature": DUMMY_PIPELINE_SIGNATURE,
            "config": {},
            "data": {
                "email": self.email,
                "id": "idp-user-123",
                "name": "New User",
                "email_verified": False,
            },
        }
        local_client = clusters.get(REDIS_CLUSTER).get_local_client_for_key(auth_key)
        local_client.set(auth_key, json.dumps(pipeline_state))

        session = self.client.session
        session["auth_key"] = auth_key
        session.save()
        assert session.session_key is not None
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key

    def _set_pending_email(self, email: str | None = None) -> None:
        session = self.client.session
        session[PENDING_VERIFICATION_SESSION_KEY] = email or self.email
        session.save()
        assert session.session_key is not None
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key

    def _get_verify_url(self, email: str | None = None, **blob_kwargs: Any) -> str:
        signed = _make_signed_blob(email=email or self.email, **blob_kwargs)
        return reverse(self.endpoint, args=[signed])

    def _get_pipeline_state(self) -> dict[str, Any]:
        auth_key = "auth:pipeline:test-sso-verification"
        local_client = clusters.get(REDIS_CLUSTER).get_local_client_for_key(auth_key)
        raw = local_client.get(auth_key)
        return json.loads(raw)

    def test_stores_verified_email_and_redirects_to_pipeline(self) -> None:
        self._setup_pipeline()
        self._set_pending_email()

        resp = self.client.get(self._get_verify_url())

        assert resp.status_code == 302
        assert resp["Location"] == reverse("sentry-auth-sso")
        assert PENDING_VERIFICATION_SESSION_KEY not in self.client.session

    @mock.patch("sentry.auth.helper.auth")
    def test_full_flow_creates_user(self, mock_auth: mock.MagicMock) -> None:
        mock_auth.login.return_value = True
        mock_auth.get_login_redirect.return_value = "/organizations/test-org/issues/"

        self._setup_pipeline()
        self._set_pending_email()

        self.client.get(self._get_verify_url(), follow=True)

        user = User.objects.get(email=self.email)
        assert user.email == self.email
        assert UserEmail.objects.get(user=user, email=self.email).is_verified is True
        assert AuthIdentity.objects.filter(
            auth_provider=self.auth_provider_inst, user=user
        ).exists()

    def test_fails_if_email_mismatch(self) -> None:
        self._setup_pipeline()
        self._set_pending_email(email="different@example.com")

        resp = self.client.get(self._get_verify_url(email="different@example.com"))

        assert resp.status_code == 400
        assert "mismatch" in resp.content.decode().lower()
        assert not User.objects.filter(email=self.email).exists()

    def test_fails_if_pipeline_expired(self) -> None:
        self._set_pending_email()

        resp = self.client.get(self._get_verify_url())

        assert resp.status_code == 400
        assert "Could not find your signup data" in resp.content.decode()
        assert not User.objects.filter(email=self.email).exists()

    def test_missing_session_data_leaves_pipeline_state_untouched(self) -> None:
        self._setup_pipeline()

        resp = self.client.get(self._get_verify_url())

        assert resp.status_code == 400
        assert "verified_email" not in self._get_pipeline_state()

    def test_email_mismatch_leaves_pipeline_state_unverified(self) -> None:
        self._setup_pipeline()
        self._set_pending_email(email="different@example.com")

        resp = self.client.get(self._get_verify_url(email="different@example.com"))

        assert resp.status_code == 400
        assert "verified_email" not in self._get_pipeline_state()

    @mock.patch("sentry.auth.helper.auth")
    def test_clicking_verification_link_twice_only_works_once(
        self, mock_auth: mock.MagicMock
    ) -> None:
        mock_auth.login.return_value = True
        mock_auth.get_login_redirect.return_value = "/organizations/test-org/issues/"

        self._setup_pipeline()
        self._set_pending_email()

        first = self.client.get(self._get_verify_url())
        assert first.status_code == 302

        second = self.client.get(self._get_verify_url())
        assert second.status_code == 400
