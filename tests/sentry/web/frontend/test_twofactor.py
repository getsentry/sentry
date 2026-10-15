from time import time

from sentry.auth.authenticators.totp import TotpInterface
from sentry.testutils.cases import TestCase
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
