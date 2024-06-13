from time import time
from unittest.mock import Mock, patch

from django.core import mail
from django.urls import reverse
from pytest import fixture

from sentry.auth.authenticators.base import ActivationChallengeResult
from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.authenticators.u2f import U2fInterface
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import control_silo_test
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response


class TwoFactorBaseTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.session["_pending_2fa"] = [self.user.id, time() - 2]
        self.save_session()


@control_silo_test
class GenericTwoFactorTest(TwoFactorBaseTestCase):
    def test_not_pending_2fa(self):
        response = self.client.get("/auth/2fa/")
        assert response.status_code == 302
        assert response["Location"] == "/auth/login/"

    def test_no_2fa_configured(self):
        response = self.client.get("/auth/2fa/", follow=True)
        assert response.redirect_chain == [
            ("/auth/login/", 302),
            ("/organizations/new/", 302),
        ]


@control_silo_test
class OTPTest(TwoFactorBaseTestCase):
    def setUp(self):
        super().setUp()
        TotpInterface().enroll(self.user)

    def test_otp_challenge(self):
        response = self.client.get("/auth/2fa/")
        assert response.status_code == 200
        self.assertTemplateUsed("sentry/twofactor.html")
        assert "provide the access code" in response.content.decode("utf8")

    @patch("sentry.auth.authenticators.TotpInterface.validate_otp", return_value=None)
    @patch("time.sleep")
    def test_otp_submit_error(self, mock_sleep, mock_validate):
        response = self.client.post("/auth/2fa/", data={"otp": "123456"}, follow=True)
        assert mock_validate.called
        assert response.status_code == 200
        assert "Invalid confirmation code" in response.content.decode("utf8")

    @patch("sentry.auth.authenticators.TotpInterface.validate_otp", return_value=True)
    def test_otp_submit_success(self, mock_validate):
        response = self.client.post("/auth/2fa/", data={"otp": "123456"}, follow=True)
        assert mock_validate.called
        assert response.redirect_chain == [
            ("/auth/login/", 302),
            ("/organizations/new/", 302),
        ]

    @patch("sentry.auth.authenticators.TotpInterface.validate_otp", return_value=False)
    @patch("time.sleep")
    def test_rate_limit(self, mock_validate, mock_sleep):
        with freeze_time("2000-01-01"):
            for _ in range(5 + 2):
                with self.tasks(), outbox_runner():
                    response = self.client.post("/auth/2fa/", data={"otp": "123456"}, follow=False)
        assert response.status_code == 429
        assert mock_validate.called

        # make sure that we sent 1 and only 1 email
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]

        assert msg.to == [self.user.email]
        assert msg.subject == "[Sentry]Suspicious Activity Detected"
        url = absolute_uri(reverse("sentry-account-settings-security"))
        assert url in msg.body
        assert "IP address: 127.0.0.1" in msg.body


@control_silo_test
class U2FTest(TwoFactorBaseTestCase):
    def setUp(self):
        super().setUp()
        U2fInterface().enroll(self.user)

    @fixture(autouse=True)
    def _set_u2f_to_available(self):
        with patch("sentry.auth.authenticators.U2fInterface.is_available", return_value=True):
            yield

    @patch(
        "sentry.web.frontend.twofactor.render_to_response",
        autospec=True,
        side_effect=render_to_response,
    )
    def test_u2f_get_challenge(self, mock_render: Mock):
        response = self.client.get("/auth/2fa/")
        assert response.status_code == 200
        self.assertTemplateUsed("sentry/twofactor.html")
        self.assertTemplateUsed("sentry/twofactor_u2f.html")

        u2f_activation: ActivationChallengeResult = mock_render.call_args.kwargs["context"][
            "activation"
        ]
        # State should not be set when the new u2f flow option is not set
        assert u2f_activation.state is None

    @override_options({"u2f.skip-session-cookie.ga-rollout": True})
    @patch(
        "sentry.web.frontend.twofactor.render_to_response",
        autospec=True,
        side_effect=render_to_response,
    )
    def test_u2f_get_challenge_with_state(self, mock_render: Mock):
        response = self.client.get("/auth/2fa/")
        assert response.status_code == 200
        self.assertTemplateUsed("sentry/twofactor.html")
        self.assertTemplateUsed("sentry/twofactor_u2f.html")

        u2f_activation: ActivationChallengeResult = mock_render.call_args.kwargs["context"][
            "activation"
        ]
        # State should be set when the new u2f flow option is not set
        state = u2f_activation.state
        assert state is not None
        assert state["challenge"] is not None
