from functools import cached_property
from urllib.parse import parse_qs

import responses

from sentry.models.rule import Rule
from sentry.plugins.base import Notification
from sentry.testutils.cases import PluginTestCase, TestCase
from sentry_plugins.twilio.plugin import TwilioConfigurationForm, TwilioPlugin, split_sms_to


class TwilioPluginSMSSplitTest(TestCase):
    def test_valid_split_sms_to(self):
        to = "330-509-3095, (330)-509-3095, +13305093095, 4045550144"
        expected = {"330-509-3095", "(330)-509-3095", "+13305093095", "4045550144"}
        actual = split_sms_to(to)
        assert expected == actual

    def test_valid_split_sms_to_with_extra_spaces(self):
        to = "330-509-3095       ,            (330)-509-3095,     +13305093095,    4045550144"
        expected = {"330-509-3095", "(330)-509-3095", "+13305093095", "4045550144"}
        actual = split_sms_to(to)
        assert expected == actual

    def test_valid_split_sms_to_with_just_spaces(self):
        to = "330-509-3095 (330)-509-3095 +13305093095 4045550144"
        expected = {"330-509-3095", "(330)-509-3095", "+13305093095", "4045550144"}
        actual = split_sms_to(to)
        assert expected == actual

    def test_valid_split_sms_to_with_no_whitespace(self):
        to = "330-509-3095,(330)-509-3095,+13305093095,4045550144"
        expected = {"330-509-3095", "(330)-509-3095", "+13305093095", "4045550144"}
        actual = split_sms_to(to)
        assert expected == actual

    def test_split_sms_to_with_single_number(self):
        to = "555-555-5555"
        expected = {"555-555-5555"}
        actual = split_sms_to(to)
        assert expected == actual

    def test_valid_split_sms_to_newline(self):
        to = "330-509-3095,\n(330)-509-3095\n,+13305093095\n,\n4045550144"
        expected = {"330-509-3095", "(330)-509-3095", "+13305093095", "4045550144"}
        actual = split_sms_to(to)
        assert expected == actual

    def test_valid_split_sms_to_with_just_newlines(self):
        to = "330-509-3095\n(330)-509-3095\n+13305093095\n\n4045550144"
        expected = {"330-509-3095", "(330)-509-3095", "+13305093095", "4045550144"}
        actual = split_sms_to(to)
        assert expected == actual

    def test_valid_split_sms_to_with_extra_newlines(self):
        to = "330-509-3095\n\n\n\n\n,\n\n\n\n\n\n\n\n\n(330)-509-3095,\n\n\n\n+13305093095,\n\n4045550144"
        expected = {"330-509-3095", "(330)-509-3095", "+13305093095", "4045550144"}
        actual = split_sms_to(to)
        assert expected == actual


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
        cleaned = form.clean()
        assert cleaned is not None
        self.assertDictEqual(
            cleaned,
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

        error_msgs = {k: [e.message for e in v] for k, v in errors.items()}

        self.assertDictEqual(
            error_msgs,
            {
                "auth_token": ["This field is required."],
                "account_sid": ["This field is required."],
                "sms_from": ["foobar is not a valid phone number."],
                "sms_to": ["911 is not a valid phone number."],
            },
        )


class TwilioPluginTest(PluginTestCase):
    @cached_property
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
