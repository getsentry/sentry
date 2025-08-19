from __future__ import annotations

import re
from typing import Any

import phonenumbers
from django import forms
from django.core.exceptions import ValidationError
from django.forms.fields import ChoiceField

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.shared_integrations.exceptions import ApiTimeoutError, IntegrationError

DEFAULT_REGION = "US"


def validate_phone(phone: str) -> bool:
    """Validate a phone number."""
    try:
        p = phonenumbers.parse(phone, DEFAULT_REGION)
    except phonenumbers.NumberParseException:
        return False
    if not phonenumbers.is_possible_number(p):
        return False
    if not phonenumbers.is_valid_number(p):
        return False
    return True


def clean_phone(phone: str) -> str:
    """Clean and format a phone number to E164 format."""
    return phonenumbers.format_number(
        phonenumbers.parse(phone, DEFAULT_REGION), phonenumbers.PhoneNumberFormat.E164
    )


def split_sms_to(data: str) -> set[str]:
    """Split SMS recipients string into set of phone numbers."""
    phone_numbers = set(re.split(r"[,\s]+", data))
    stripped_phone_numbers = {num.strip() for num in phone_numbers if num.strip()}
    return stripped_phone_numbers


class TwilioConfigurationForm(forms.Form):
    # NOTE: account (account_sid) maps directly to the integration ID
    account = forms.ChoiceField(choices=(), widget=forms.Select())
    sms_to = forms.CharField(widget=forms.TextInput())

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        account_list = [(i.id, i.name) for i in kwargs.pop("integrations")]

        super().__init__(*args, **kwargs)

        if account_list:
            assert isinstance(self.fields["account"], ChoiceField)
            self.fields["account"].initial = account_list[0][0]
            self.fields["account"].choices = account_list
            self.fields["account"].widget.choices = account_list

    def _format_twilio_error_message(self, message: str) -> str:
        return f"Twilio: {message}"

    def clean(self) -> dict[str, object] | None:
        cleaned_data: dict[str, object] = super().clean() or {}
        sms_to = cleaned_data.get("sms_to")
        account = cleaned_data.get("account")
        integration = integration_service.get_integration(
            integration_id=account, status=ObjectStatus.ACTIVE
        )

        if not account or not integration:
            raise forms.ValidationError(
                self._format_twilio_error_message("Account is a required field."),
                code="invalid",
            )

        if sms_to and isinstance(sms_to, str):
            try:
                phones = split_sms_to(sms_to)

                if not phones:
                    raise ValidationError("At least one phone number is required.")

                if len(phones) > 10:
                    raise ValidationError(
                        f"Maximum of 10 phone numbers allowed, {len(phones)} were given."
                    )

                cleaned_phones = []
                for phone in phones:
                    if not validate_phone(phone):
                        raise ValidationError(f"{phone} is not a valid phone number.")
                    cleaned_phones.append(clean_phone(phone))

                # Store cleaned phone numbers as comma-separated string
                cleaned_data["sms_to"] = ",".join(sorted(set(cleaned_phones)))

            except ValidationError as e:
                raise forms.ValidationError(
                    self._format_twilio_error_message("; ".join(e.messages)),
                    code="invalid",
                )
            except IntegrationError as e:
                raise forms.ValidationError(
                    self._format_twilio_error_message(str(e)),
                    code="invalid",
                )
            except ApiTimeoutError:
                raise forms.ValidationError("Twilio phone validation timed out")

        return cleaned_data
