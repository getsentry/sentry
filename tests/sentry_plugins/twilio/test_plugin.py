from __future__ import absolute_import

from exam import fixture
from sentry.testutils import TestCase, PluginTestCase
from sentry_plugins.twilio.plugin import TwilioConfigurationForm, TwilioPlugin


class TwilioConfigurationFormTest(TestCase):
    def test_valid_form(self):
        form = TwilioConfigurationForm(
            data={
                "sms_from": "3305093095",
                "sms_to": "330-509-3095, (330)-509-3095, +13305093095, 4045550144",
                "auth_token": "foo",
                "account_sid": "bar",
            }
        )

        self.assertTrue(form.is_valid())
        self.assertDictEqual(
            form.clean(),
            {
                "auth_token": u"foo",
                "sms_to": u"+13305093095,+14045550144",
                "sms_from": u"+13305093095",
                "account_sid": u"bar",
            },
        )

    def test_invalid_form(self):
        form = TwilioConfigurationForm(data={"sms_from": "foobar", "sms_to": "911"})
        self.assertFalse(form.is_valid())
        errors = form.errors.as_data()

        # extracting the message from django.forms.ValidationError
        # is the easiest and simplest way I've found to assert as_data
        for e in errors:
            errors[e] = list(map(lambda x: x.message, errors[e]))

        self.assertDictEqual(
            errors,
            {
                "auth_token": [u"This field is required."],
                "account_sid": [u"This field is required."],
                "sms_from": [u"foobar is not a valid phone number."],
                "sms_to": [u"911 is not a valid phone number."],
            },
        )


class TwilioPluginTest(PluginTestCase):
    # TODO: actually test the plugin

    @fixture
    def plugin(self):
        return TwilioPlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "twilio"

    def test_entry_point(self):
        self.assertPluginInstalled("twilio", self.plugin)

    def test_is_configured(self):
        assert self.plugin.is_configured(self.project) is False
        for o in ("account_sid", "auth_token", "sms_from", "sms_to"):
            self.plugin.set_option(o, "foo", self.project)
        assert self.plugin.is_configured(self.project) is True
