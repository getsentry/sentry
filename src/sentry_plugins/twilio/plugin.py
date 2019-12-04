from __future__ import absolute_import

import re
import phonenumbers

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry import http
from sentry.plugins.bases.notify import NotificationPlugin

import sentry

DEFAULT_REGION = "US"
MAX_SMS_LENGTH = 160

twilio_sms_endpoint = "https://api.twilio.com/2010-04-01/Accounts/{0}/SMS/Messages.json"


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


def basic_auth(user, password):
    return "Basic " + (user + ":" + password).encode("base64").replace("\n", "")


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
            raise forms.ValidationError("{0} is not a valid phone number.".format(data))
        return clean_phone(data)

    def clean_sms_to(self):
        data = self.cleaned_data["sms_to"]
        phones = split_sms_to(data)
        if len(phones) > 10:
            raise forms.ValidationError(
                "Max of 10 phone numbers, {0} were given.".format(len(phones))
            )
        for phone in phones:
            if not validate_phone(phone):
                raise forms.ValidationError("{0} is not a valid phone number.".format(phone))
        return ",".join(sorted(map(clean_phone, phones)))

    def clean(self):
        # TODO: Ping Twilio and check credentials (?)
        return self.cleaned_data


class TwilioPlugin(NotificationPlugin):
    author = "Matt Robenolt"
    author_url = "https://github.com/mattrobenolt"
    version = sentry.VERSION
    description = "A plugin for Sentry which sends SMS notifications via Twilio"
    resource_links = (
        # TODO: Update documentation link
        # ('Documentation', 'https://github.com/ge/sentry-twilio/blob/master/README.md'),
        ("Bug Tracker", "https://github.com/getsentry/sentry/issues"),
        ("Source", "https://github.com/getsentry/sentry"),
        ("Twilio", "https://www.twilio.com/"),
    )

    slug = "twilio"
    title = _("Twilio (SMS)")
    conf_title = title
    conf_key = "twilio"
    project_conf_form = TwilioConfigurationForm

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

    def notify_users(self, group, event, **kwargs):
        project = group.project

        body = "Sentry [{0}] {1}: {2}".format(
            project.name.encode("utf-8"),
            event.group.get_level_display().upper().encode("utf-8"),
            event.title.encode("utf-8").splitlines()[0],
        )
        body = body[:MAX_SMS_LENGTH]

        account_sid = self.get_option("account_sid", project)
        auth_token = self.get_option("auth_token", project)
        sms_from = clean_phone(self.get_option("sms_from", project))
        endpoint = twilio_sms_endpoint.format(account_sid)

        sms_to = self.get_option("sms_to", project)
        if not sms_to:
            return
        sms_to = split_sms_to(sms_to)

        headers = {"Authorization": basic_auth(account_sid, auth_token)}

        errors = []

        for phone in sms_to:
            if not phone:
                continue
            try:
                phone = clean_phone(phone)
                http.safe_urlopen(
                    endpoint,
                    method="POST",
                    headers=headers,
                    data={"From": sms_from, "To": phone, "Body": body},
                ).raise_for_status()
            except Exception as e:
                errors.append(e)

        if errors:
            if len(errors) == 1:
                raise errors[0]

            # TODO: multi-exception
            raise Exception(errors)
