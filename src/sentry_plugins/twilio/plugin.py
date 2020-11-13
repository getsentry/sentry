from __future__ import absolute_import

import re
import phonenumbers

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.plugins.bases.notify import NotificationPlugin
from sentry.integrations import FeatureDescription, IntegrationFeatures

from .client import TwilioApiClient
from sentry_plugins.base import CorePluginMixin

import sentry
from sentry.utils.compat import map
from sentry.utils.compat import filter

DEFAULT_REGION = "US"
MAX_SMS_LENGTH = 160

DESCRIPTION = """
Get notified of Sentry alerts via SMS.

Twilio allows users to send and receive text messages globally with
the API that over a million developers depend on.
"""


def validate_phone(phone):
    try:
        p = phonenumbers.parse(phone, DEFAULT_REGION)
    except phonenumbers.NumberParseException:
        return False
    if not phonenumbers.is_possible_number(p):
        return False
    if not phonenumbers.is_valid_number(p):
        return False
    return True


def clean_phone(phone):
    # This could raise, but should have been checked with validate_phone first
    return phonenumbers.format_number(
        phonenumbers.parse(phone, DEFAULT_REGION), phonenumbers.PhoneNumberFormat.E164
    )


# XXX: can likely remove the dedupe here after notify_users has test coverage;
#      in theory only cleaned data would make it to the plugin via the form,
#      and cleaned numbers are deduped already.
def split_sms_to(data):
    return set(filter(bool, re.split(r"\s*,\s*|\s+", data)))


class TwilioConfigurationForm(forms.Form):
    account_sid = forms.CharField(
        label=_("Account SID"), required=True, widget=forms.TextInput(attrs={"class": "span6"})
    )
    auth_token = forms.CharField(
        label=_("Auth Token"),
        required=True,
        widget=forms.PasswordInput(render_value=True, attrs={"class": "span6"}),
    )
    sms_from = forms.CharField(
        label=_("SMS From #"),
        required=True,
        help_text=_("Digits only"),
        widget=forms.TextInput(attrs={"placeholder": "e.g. 3305093095"}),
    )
    sms_to = forms.CharField(
        label=_("SMS To #s"),
        required=True,
        help_text=_("Recipient(s) phone numbers separated by commas or lines"),
        widget=forms.Textarea(attrs={"placeholder": "e.g. 3305093095, 5555555555"}),
    )

    def clean_sms_from(self):
        data = self.cleaned_data["sms_from"]
        if not validate_phone(data):
            raise forms.ValidationError(u"{0} is not a valid phone number.".format(data))
        return clean_phone(data)

    def clean_sms_to(self):
        data = self.cleaned_data["sms_to"]
        phones = split_sms_to(data)
        if len(phones) > 10:
            raise forms.ValidationError(
                u"Max of 10 phone numbers, {0} were given.".format(len(phones))
            )
        for phone in phones:
            if not validate_phone(phone):
                raise forms.ValidationError(u"{0} is not a valid phone number.".format(phone))
        return ",".join(sorted(set(map(clean_phone, phones))))

    def clean(self):
        # TODO: Ping Twilio and check credentials (?)
        return self.cleaned_data


class TwilioPlugin(CorePluginMixin, NotificationPlugin):
    author = "Matt Robenolt"
    author_url = "https://github.com/mattrobenolt"
    version = sentry.VERSION
    description = DESCRIPTION
    resource_links = (
        (
            "Documentation",
            "https://github.com/getsentry/sentry/blob/master/src/sentry_plugins/twilio/Twilio_Instructions.md",
        ),
        ("Report Issue", "https://github.com/getsentry/sentry/issues"),
        (
            "View Source",
            "https://github.com/getsentry/sentry/tree/master/src/sentry_plugins/twilio",
        ),
        ("Twilio", "https://www.twilio.com/"),
    )

    slug = "twilio"
    title = _("Twilio (SMS)")
    conf_title = title
    conf_key = "twilio"
    required_field = "account_sid"
    project_conf_form = TwilioConfigurationForm
    feature_descriptions = [
        FeatureDescription(
            """
            Set up SMS notifications to be sent to your mobile device via Twilio.
            """,
            IntegrationFeatures.MOBILE,
        ),
        FeatureDescription(
            """
            Configure Sentry rules to trigger notifications based on conditions you set.
            """,
            IntegrationFeatures.ALERT_RULE,
        ),
    ]

    def is_configured(self, project, **kwargs):
        return all(
            [
                self.get_option(o, project)
                for o in ("account_sid", "auth_token", "sms_from", "sms_to")
            ]
        )

    def get_send_to(self, *args, **kwargs):
        # This doesn't depend on email permission... stuff.
        return True

    def error_message_from_json(self, data):
        code = data.get("code")
        message = data.get("message")
        more_info = data.get("more_info")
        error_message = "%s - %s %s" % (code, message, more_info)
        if message:
            return error_message
        return None

    def notify_users(self, group, event, **kwargs):
        if not self.is_configured(group.project):
            return
        project = group.project

        body = b"Sentry [%s] %s: %s" % (
            project.name.encode("utf-8"),
            event.group.get_level_display().upper().encode("utf-8"),
            event.title.encode("utf-8").splitlines()[0],
        )
        body = body[:MAX_SMS_LENGTH]

        client = self.get_client(group.project)

        payload = {"From": client.sms_from, "Body": body}

        errors = []

        for phone in client.sms_to:
            if not phone:
                continue
            try:
                # TODO: Use API client with raise_error
                phone = clean_phone(phone)
                payload = payload.copy()
                payload["To"] = phone
                client.request(payload)
            except Exception as e:
                errors.append(e)

        if errors:
            self.raise_error(errors[0])

    def get_client(self, project):
        account_sid = self.get_option("account_sid", project)
        auth_token = self.get_option("auth_token", project)
        sms_from = clean_phone(self.get_option("sms_from", project))
        sms_to = self.get_option("sms_to", project)
        sms_to = split_sms_to(sms_to)
        return TwilioApiClient(account_sid, auth_token, sms_from, sms_to)
