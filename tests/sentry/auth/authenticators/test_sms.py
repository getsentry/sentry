import datetime

import pytest
import responses
from django.http import HttpRequest
from freezegun import freeze_time

from sentry.auth.authenticators import SmsInterface
from sentry.auth.authenticators.sms import SMSRateLimitExceeded
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.sms import InvalidPhoneNumber, phone_number_as_e164


@control_silo_test(stable=True)
class SmsInterfaceTest(TestCase):
    def setUp(self):
        self.user = self.create_user(email="test@example.com", is_superuser=False)

    @responses.activate
    def test_activate(self):
        request = HttpRequest()
        request.user = self.user
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        responses.add(
            responses.POST,
            "https://api.twilio.com/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages.json",
            json={
                "account_sid": "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                "api_version": "2010-04-01",
                "body": "Hi there!",
                "date_created": "Thu, 30 Jul 2015 20:12:31 +0000",
                "date_sent": "Thu, 30 Jul 2015 20:12:33 +0000",
                "date_updated": "Thu, 30 Jul 2015 20:12:33 +0000",
                "direction": "outbound-api",
                "error_code": None,
                "error_message": None,
                "from": "+15551231234",
                "messaging_service_sid": None,
                "num_media": "0",
                "num_segments": "1",
                "price": None,
                "price_unit": None,
                "sid": "SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                "status": "sent",
                "subresource_uris": {
                    "media": "/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages/SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Media.json"
                },
                "to": "+12345678901",
                "uri": "/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages/SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.json",
            },
        )

        interface = SmsInterface()
        interface.phone_number = "2345678901"

        with self.options({"sms.twilio-account": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"}):
            rv = interface.activate(request)

        assert (
            rv.message
            == "A confirmation code was sent to <strong>(***) ***-**01</strong>. It is valid for 45 seconds."
        )

    @responses.activate
    def test_ratelimit_exception(self):
        request = HttpRequest()
        request.user = self.user
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        responses.add(
            responses.POST,
            "https://api.twilio.com/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages.json",
            json={
                "account_sid": "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                "api_version": "2010-04-01",
                "body": "Hi there!",
                "date_created": "Thu, 30 Jul 2015 20:12:31 +0000",
                "date_sent": "Thu, 30 Jul 2015 20:12:33 +0000",
                "date_updated": "Thu, 30 Jul 2015 20:12:33 +0000",
                "direction": "outbound-api",
                "error_code": None,
                "error_message": None,
                "from": "+15551231234",
                "messaging_service_sid": None,
                "num_media": "0",
                "num_segments": "1",
                "price": None,
                "price_unit": None,
                "sid": "SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                "status": "sent",
                "subresource_uris": {
                    "media": "/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages/SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Media.json"
                },
                "to": "+12345678901",
                "uri": "/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages/SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.json",
            },
        )

        interface = SmsInterface()
        interface.phone_number = "2345678901"

        with freeze_time(datetime.datetime.now()):
            with self.options({"sms.twilio-account": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"}):
                with pytest.raises(SMSRateLimitExceeded):
                    for _ in range(4):
                        rv = interface.activate(request)

                interface.phone_number = "2345678900"
                rv = interface.activate(request)
                assert (
                    rv.message
                    == "A confirmation code was sent to <strong>(***) ***-**00</strong>. It is valid for 45 seconds."
                )

    def test_invalid_phone_number(self):
        with pytest.raises(InvalidPhoneNumber):
            phone_number_as_e164("+15555555555")

    def test_valid_phone_number(self):
        formatted_number = phone_number_as_e164("2345678900")
        assert "+12345678900" == formatted_number
