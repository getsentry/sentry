"""
Regression guards for the four historical ``window.__initialData = {};``
incidents that followed sentry#81654 (see getsentry/sentry#82396, #82480,
#82518, #108157). Each of these shipped because a view that rendered a
template extending ``sentry/layout.html`` forgot to inject ``react_config``
into its template context.

These tests render each of the previously-broken pages end-to-end via the
Django test client and assert that the returned HTML embeds a
populated ``window.__initialData`` object — so any future regression in the
context processor chain or in the base layout template is caught loudly.
"""

from __future__ import annotations

import re

from django.urls import reverse

from sentry.models.authprovider import AuthProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

INITIAL_DATA_RE = re.compile(r"window\.__initialData\s*=\s*(.*?);\s*</?", re.DOTALL)


def _parse_initial_data(html: str) -> dict:
    """Extract the JSON object assigned to ``window.__initialData`` and return
    it as a parsed dict. Fails loudly if the bootstrap is empty or missing."""
    from sentry.utils import json

    match = INITIAL_DATA_RE.search(html)
    assert match is not None, "window.__initialData bootstrap missing from rendered HTML"
    raw = match.group(1).strip()
    assert raw not in {"", "null", "{}", '""'}, (
        f"window.__initialData rendered as empty bootstrap ({raw!r}) — "
        "the react_config context processor chain is broken"
    )
    data = json.loads(raw)
    assert isinstance(data, dict)
    return data


@control_silo_test
class ReactConfigRegressionTest(TestCase):
    def _assert_initial_data_populated(self, response) -> dict:
        assert response.status_code == 200
        data = _parse_initial_data(response.content.decode())
        # These keys are load-bearing for the SPA bootstrap; if any is missing
        # the frontend will crash before rendering anything.
        for key in ("features", "regions", "memberRegions", "sentryConfig", "links"):
            assert key in data, f"{key!r} missing from window.__initialData"
        return data

    def test_auth_login_page_bootstraps(self) -> None:
        """Covers #82396 and #82480 — login page used to ship empty."""
        response = self.client.get(reverse("sentry-login"))
        self._assert_initial_data_populated(response)

    def test_auth_organization_login_page_bootstraps(self) -> None:
        """Covers #82480 — org-scoped login page."""
        org = self.create_organization()
        response = self.client.get(reverse("sentry-auth-organization", args=[org.slug]))
        self._assert_initial_data_populated(response)

    def test_oauth_authorize_page_bootstraps(self) -> None:
        """Covers #82480 — OAuth authorize page extends the auth login template."""
        from sentry.models.apiapplication import ApiApplication

        user = self.create_user()
        app = ApiApplication.objects.create(
            owner=user, name="Test OAuth App", redirect_uris="https://example.com/callback"
        )
        response = self.client.get(
            "/oauth/authorize/",
            {
                "response_type": "code",
                "client_id": app.client_id,
                "redirect_uri": "https://example.com/callback",
                "scope": "org:read",
            },
        )
        # Unauthenticated user is prompted to log in via the OAuth authorize
        # flow, which extends the same auth template family that regressed
        # in #82480.
        self._assert_initial_data_populated(response)

    def test_two_factor_page_bootstraps(self) -> None:
        """Covers #82518 — 2FA challenge page used to ship empty."""
        import time

        from sentry.auth.authenticators.totp import TotpInterface

        user = self.create_user()
        TotpInterface().enroll(user)
        self.login_as(user)

        # Put the user in the pending-2FA state so /auth/2fa/ renders the
        # challenge page instead of redirecting.
        self.session["_pending_2fa"] = [user.id, time.time() - 2]
        self.save_session()

        response = self.client.get("/auth/2fa/")
        self._assert_initial_data_populated(response)

    def test_react_page_bootstraps(self) -> None:
        """Covers ReactMixin.handle_react — the main SPA shell entry point
        that all org-scoped SPA routes fall through to."""
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user)
        response = self.client.get(f"/organizations/{org.slug}/issues/", follow=True)
        self._assert_initial_data_populated(response)

    def test_unauthenticated_login_has_org_bootstrap(self) -> None:
        """An unauthenticated user hitting a login page should still receive a
        valid bootstrap — ``user`` is ``None`` but the config keys are present.
        """
        response = self.client.get(reverse("sentry-login"))
        data = self._assert_initial_data_populated(response)
        assert data["isAuthenticated"] is False
        assert data["user"] is None


@control_silo_test
class ReactConfigAuthProviderFlowTest(TestCase):
    """Separate class so the AuthProvider fixture lives alongside the SSO
    bootstrap assertion without bleeding into the other tests."""

    def test_org_login_with_auth_provider_bootstraps(self) -> None:
        org = self.create_organization()
        AuthProvider.objects.create(organization_id=org.id, provider="dummy")

        response = self.client.get(reverse("sentry-auth-organization", args=[org.slug]))
        assert response.status_code == 200
        # The SSO-enabled login page renders organization-login.html which
        # also extends the auth base template.
        data = _parse_initial_data(response.content.decode())
        assert isinstance(data.get("features"), list)
