from time import time

from django.test import override_settings
from django.urls import reverse

from sentry.auth.authenticators.totp import TotpInterface
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TwoFactorTest(TestCase):
    def test_pending_2fa_redirects_to_react_auth(self) -> None:
        user = self.create_user()
        TotpInterface().enroll(user)
        self.login_as(user)
        pending_2fa = [user.id, time() - 2]
        self.session["_pending_2fa"] = pending_2fa
        self.session["_after_2fa"] = "/auth/sso/"
        self.session["_next"] = "/_admin/"
        self.save_session()

        resp = self.client.get("/auth/2fa/")

        assert resp.status_code == 302
        assert resp["Location"] == "/auth/login/"
        assert self.client.session["_pending_2fa"] == pending_2fa
        assert self.client.session["_after_2fa"] == "/auth/sso/"
        assert self.client.session["_next"] == "/_admin/"

    def test_pending_2fa_post_redirects_to_react_auth(self) -> None:
        user = self.create_user()
        TotpInterface().enroll(user)
        self.login_as(user)
        pending_2fa = [user.id, time() - 2]
        self.session["_pending_2fa"] = pending_2fa
        self.session["_after_2fa"] = "/auth/sso/"
        self.session["_next"] = "/_admin/"
        self.save_session()

        resp = self.client.post("/auth/2fa/")

        assert resp.status_code == 302
        assert resp["Location"] == "/auth/login/"
        assert self.client.session["_pending_2fa"] == pending_2fa
        assert self.client.session["_after_2fa"] == "/auth/sso/"
        assert self.client.session["_next"] == "/_admin/"

    def test_not_pending_2fa(self) -> None:
        resp = self.client.get("/auth/2fa/")
        assert resp.status_code == 302
        assert resp["Location"] == "/auth/login/"

    def test_no_2fa_configured_with_react_auth(self) -> None:
        user = self.create_user()
        self.login_as(user)
        self.session["_pending_2fa"] = [user.id, time() - 2]
        self.save_session()

        resp = self.client.get("/auth/2fa/")

        assert resp.status_code == 302
        assert "_pending_2fa" not in self.client.session


@control_silo_test
class U2fAppIdTest(TestCase):
    @override_settings(SENTRY_U2F_FACETS=["https://auth.example.invalid/"])
    def test_deployment_facets(self) -> None:
        response = self.client.get(reverse("sentry-u2f-app-id"))

        assert response.status_code == 200
        assert response.json() == {
            "trustedFacets": [
                {"version": {"major": 1, "minor": 0}, "ids": ["https://auth.example.invalid"]}
            ]
        }

    @override_settings(SENTRY_U2F_FACETS=[])
    @override_options({"system.url-prefix": "https://sentry.example.invalid/"})
    def test_empty_facets_use_url_prefix(self) -> None:
        response = self.client.get(reverse("sentry-u2f-app-id"))

        assert response.status_code == 200
        assert response.json() == {
            "trustedFacets": [
                {"version": {"major": 1, "minor": 0}, "ids": ["https://sentry.example.invalid"]}
            ]
        }
