from time import time
from unittest import mock

from sentry.auth.authenticators.totp import TotpInterface
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class TwoFactorTest(TestCase):
    def test_not_pending_2fa(self):
        resp = self.client.get("/auth/2fa/")
        assert resp.status_code == 302
        assert resp["Location"] == "/auth/login/"

    def test_no_2fa_configured(self):
        user = self.create_user()
        self.login_as(user)

        self.session["_pending_2fa"] = [user.id, time() - 2]
        self.save_session()

        resp = self.client.get("/auth/2fa/", follow=True)
        assert resp.redirect_chain == [
            ("/auth/login/", 302),
            ("/organizations/new/", 302),
        ]

    def test_otp_challenge(self):
        user = self.create_user()
        interface = TotpInterface()
        interface.enroll(user)

        self.login_as(user)
        self.session["_pending_2fa"] = [user.id, time() - 2]
        self.save_session()

        resp = self.client.get("/auth/2fa/")
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/twofactor.html")
        assert "provide the access code" in resp.content.decode("utf8")

    @mock.patch("sentry.auth.authenticators.TotpInterface.validate_otp", return_value=None)
    @mock.patch("time.sleep")
    def test_otp_submit_error(self, mock_sleep, mock_validate):
        user = self.create_user()
        interface = TotpInterface()
        interface.enroll(user)

        self.login_as(user)
        self.session["_pending_2fa"] = [user.id, time() - 2]
        self.save_session()

        resp = self.client.post("/auth/2fa/", data={"otp": "123456"}, follow=True)
        assert mock_validate.called
        assert resp.status_code == 200
        assert "Invalid confirmation code" in resp.content.decode("utf8")

    @mock.patch("sentry.auth.authenticators.TotpInterface.validate_otp", return_value=True)
    def test_otp_submit_success(self, mock_validate):
        user = self.create_user()
        interface = TotpInterface()
        interface.enroll(user)

        self.login_as(user)
        self.session["_pending_2fa"] = [user.id, time() - 2]
        self.save_session()

        resp = self.client.post("/auth/2fa/", data={"otp": "123456"}, follow=True)
        assert mock_validate.called
        assert resp.redirect_chain == [
            ("/auth/login/", 302),
            ("/organizations/new/", 302),
        ]
