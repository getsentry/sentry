from time import time
from unittest import mock

from django.core import mail
from django.urls import reverse

from sentry.auth.authenticators.totp import TotpInterface
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import control_silo_test
from sentry.utils.http import absolute_uri


@control_silo_test
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

    @mock.patch("sentry.auth.authenticators.TotpInterface.validate_otp", return_value=False)
    @mock.patch("time.sleep")
    def test_rate_limit(self, mock_validate, mock_sleep):
        user = self.create_user()
        user.set_password("helloworld!")
        user.save()

        interface = TotpInterface()
        interface.enroll(user)

        self.login_as(user)
        self.session["_pending_2fa"] = [user.id, time() - 2]
        self.save_session()
        with freeze_time("2000-01-01"):
            for _ in range(5 + 2):
                with self.tasks(), outbox_runner():
                    resp = self.client.post("/auth/2fa/", data={"otp": "123456"}, follow=False)
        assert resp.status_code == 429
        assert mock_validate.called

        # make sure that we sent 1 and only 1 email
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]

        assert msg.to == [user.email]
        assert msg.subject == "[Sentry]Suspicious Activity Detected"
        url = absolute_uri(reverse("sentry-account-settings-security"))
        assert url in msg.body
        assert "IP address: 127.0.0.1" in msg.body

        with freeze_time("2000-01-01"):
            # 2FA rate limiter is reset after updating the password
            url = absolute_uri(reverse("sentry-api-0-user-password", args=[user.id]))
            self.client.put(
                url,
                content_type="application/json",
                data={
                    "password": "helloworld!",
                    "passwordNew": "testpassword",
                    "passwordVerify": "testpassword",
                },
            )

            resp = self.client.post("/auth/2fa/", data={"otp": "123456"}, follow=False)
            assert resp.status_code != 429
