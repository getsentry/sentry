from urllib.parse import parse_qs

import responses
from exam import fixture

from sentry.models import Rule
from sentry.plugins.base import Notification
from sentry.testutils import PluginTestCase, TestCase
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
                "auth_token": "foo",
                "sms_to": "+13305093095,+14045550144",
                "sms_from": "+13305093095",
                "account_sid": "bar",
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
                "auth_token": ["This field is required."],
                "account_sid": ["This field is required."],
                "sms_from": ["foobar is not a valid phone number."],
                "sms_to": ["911 is not a valid phone number."],
            },
        )


class TwilioPluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return TwilioPlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "twilio"

    def test_entry_point(self):
        self.assertPluginInstalled("twilio", self.plugin)

    def test_is_configured(self):
        for o in ("account_sid", "auth_token", "sms_from", "sms_to"):
            assert self.plugin.is_configured(self.project) is False
            self.plugin.set_option(o, "foo", self.project)
        assert self.plugin.is_configured(self.project) is True

    @responses.activate
    def test_simple_notification(self):
        responses.add("POST", "https://api.twilio.com/2010-04-01/Accounts/abcdef/Messages.json")
        self.plugin.set_option("account_sid", "abcdef", self.project)
        self.plugin.set_option("auth_token", "abcd", self.project)
        self.plugin.set_option("sms_from", "4158675309", self.project)
        self.plugin.set_option("sms_to", "4154444444", self.project)

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "warning",
                "platform": "python",
                "culprit": "foo.bar",
            },
            project_id=self.project.id,
        )

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = parse_qs(request.body)
        assert payload == {
            "To": ["+14154444444"],
            "From": ["+14158675309"],
            "Body": ["Sentry [%s] WARNING: Hello world" % self.project.slug.title()],
        }
