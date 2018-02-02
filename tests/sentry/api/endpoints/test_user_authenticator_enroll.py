from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse
from django.conf import settings

from sentry.models import Authenticator
from sentry.testutils import APITestCase


class UserAuthenticatorEnrollTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email='a@example.com', is_superuser=False)
        self.login_as(user=self.user)

    @mock.patch('sentry.models.TotpInterface.validate_otp', return_value=True)
    def test_totp_can_enroll(self, validate_otp):
        url = reverse(
            'sentry-api-0-user-authenticator-enroll', kwargs={'user_id': 'me', 'interface_id': 'totp'}
        )

        resp = self.client.get(url)
        assert resp.status_code == 200
        assert len(resp.data['qrcode'])
        assert resp.data['form']
        assert resp.data['secret']

        # try to enroll
        resp = self.client.post(url, data={
            "secret": "secret12",
            "otp": "1234",
        })
        assert validate_otp.call_count == 1
        assert validate_otp.call_args == mock.call("1234")
        assert resp.status_code == 204

        interface = Authenticator.objects.get_interface(user=self.user, interface_id="totp")
        assert interface

        # also enrolls in recovery codes
        recovery = Authenticator.objects.get_interface(user=self.user, interface_id="recovery")
        assert recovery.is_enrolled

        # can't enroll again because no multi enrollment is allowed
        resp = self.client.get(url)
        assert resp.status_code == 400
        resp = self.client.post(url)
        assert resp.status_code == 400

    @mock.patch('sentry.models.TotpInterface.validate_otp', return_value=False)
    def test_invalid_otp(self, validate_otp):
        url = reverse(
            'sentry-api-0-user-authenticator-enroll', kwargs={'user_id': 'me', 'interface_id': 'totp'}
        )

        # try to enroll
        resp = self.client.post(url, data={
            "secret": "secret12",
            "otp": "1234",
        })
        assert validate_otp.call_count == 1
        assert validate_otp.call_args == mock.call("1234")
        assert resp.status_code == 400

    @mock.patch('sentry.models.SmsInterface.validate_otp', return_value=True)
    @mock.patch('sentry.models.SmsInterface.send_text', return_value=True)
    def test_sms_can_enroll(self, send_text, validate_otp):
        new_options = settings.SENTRY_OPTIONS.copy()
        new_options['sms.twilio-account'] = 'twilio-account'

        with self.settings(SENTRY_OPTIONS=new_options):
            url = reverse(
                'sentry-api-0-user-authenticator-enroll', kwargs={'user_id': 'me', 'interface_id': 'sms'}
            )

            resp = self.client.get(url)
            assert resp.status_code == 200
            assert resp.data['form']
            assert resp.data['secret']

            resp = self.client.post(url, data={
                "secret": "secret12",
                "phone": "1231234",
            })
            assert send_text.call_count == 1
            assert validate_otp.call_count == 0
            assert resp.status_code == 204

            resp = self.client.post(url, data={
                "secret": "secret12",
                "phone": "1231234",
                "otp": "123123",
            })
            assert validate_otp.call_count == 1
            assert validate_otp.call_args == mock.call("123123")

            interface = Authenticator.objects.get_interface(user=self.user, interface_id="sms")
            assert interface.phone_number == "1231234"

    @mock.patch('sentry.models.U2fInterface.try_enroll', return_value=True)
    def test_u2f_can_enroll(self, try_enroll):
        new_options = settings.SENTRY_OPTIONS.copy()
        new_options['system.url-prefix'] = 'https://testserver'
        with self.settings(SENTRY_OPTIONS=new_options):
            url = reverse(
                'sentry-api-0-user-authenticator-enroll', kwargs={'user_id': 'me', 'interface_id': 'u2f'}
            )

            resp = self.client.get(url)
            assert resp.status_code == 200
            assert resp.data['form']
            assert 'secret' not in resp.data
            assert 'qrcode' not in resp.data
            assert resp.data['challenge']

            #
            resp = self.client.post(url, data={
                "deviceName": "device name",
                "challenge": "challenge",
                "response": "response",
            })
            assert try_enroll.call_count == 1
            assert try_enroll.call_args == mock.call("challenge", "response", "device name")
            assert resp.status_code == 204
