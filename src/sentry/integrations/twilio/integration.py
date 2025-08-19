from __future__ import annotations

import logging
import re
from collections.abc import Mapping, Sequence
from typing import Any

import phonenumbers
from django import forms
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.translation import gettext_lazy as _

from sentry.integrations.base import (
    FeatureDescription,
    Integration,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.pipeline.views.base import PipelineView
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.web.helpers import render_to_response

from .client import TwilioApiClient, TwilioClient

logger = logging.getLogger("sentry.integrations.twilio")

DEFAULT_REGION = "US"
MAX_SMS_LENGTH = 160

DESCRIPTION = """
Connect your Sentry organization to Twilio to send SMS notifications for alerts and issues.
"""

FEATURES = [
    FeatureDescription(
        """
        Send SMS notifications for Sentry alerts
        """,
        IntegrationFeatures.MOBILE,
    ),
    FeatureDescription(
        """
        Configure alert rules to send SMS notifications
        """,
        IntegrationFeatures.ALERT_RULE,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/twilio",
    aspects={},
)


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
    account_sid = forms.CharField(
        label=_("Account SID"),
        required=True,
        help_text=_("Your Twilio Account SID from the Twilio Console"),
        widget=forms.TextInput(attrs={"placeholder": "xxx"}),
    )
    auth_token = forms.CharField(
        label=_("Auth Token"),
        required=True,
        help_text=_("Your Twilio Auth Token from the Twilio Console"),
        widget=forms.PasswordInput(
            render_value=True, attrs={"placeholder": "********************************"}
        ),
    )
    messaging_service_sid = forms.CharField(
        label=_("Messaging Service SID"),
        required=False,
        help_text=_("Your Twilio Messaging Service SID (optional, use this OR SMS From Number)"),
        widget=forms.TextInput(attrs={"placeholder": "MG1234567890abcdef1234567890abcdef"}),
    )
    sms_from = forms.CharField(
        label=_("SMS From Number"),
        required=False,
        help_text=_(
            "Your Twilio phone number to send SMS from (E.164 format). Required if not using Messaging Service SID"
        ),
        widget=forms.TextInput(attrs={"placeholder": "+1234567890"}),
    )
    sms_to = forms.CharField(
        label=_("Default SMS Recipients"),
        required=False,
        help_text=_(
            "Default phone numbers to receive SMS notifications (comma or space separated)"
        ),
        widget=forms.Textarea(attrs={"placeholder": "+1234567890, +0987654321", "rows": 3}),
    )

    def clean_sms_from(self):
        data = self.cleaned_data.get("sms_from", "")
        if not data:
            return ""
        if not validate_phone(data):
            raise forms.ValidationError(f"{data} is not a valid phone number.")
        return clean_phone(data)

    def clean_sms_to(self):
        data = self.cleaned_data.get("sms_to", "")
        if not data:
            return ""

        phones = split_sms_to(data)
        if len(phones) > 10:
            raise forms.ValidationError(
                f"Maximum of 10 phone numbers allowed, {len(phones)} were given."
            )

        cleaned_phones = []
        for phone in phones:
            if not validate_phone(phone):
                raise forms.ValidationError(f"{phone} is not a valid phone number.")
            cleaned_phones.append(clean_phone(phone))

        return ",".join(sorted(set(cleaned_phones)))

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()
        if not cleaned_data:
            return None

        # Ensure either messaging_service_sid or sms_from is provided
        messaging_service_sid = cleaned_data.get("messaging_service_sid")
        sms_from = cleaned_data.get("sms_from")

        if not messaging_service_sid and not sms_from:
            raise forms.ValidationError(
                "Either Messaging Service SID or SMS From Number is required."
            )

        # Verify credentials with Twilio
        account_sid = cleaned_data.get("account_sid")
        auth_token = cleaned_data.get("auth_token")

        if account_sid and auth_token:
            client = TwilioClient(account_sid=account_sid, auth_token=auth_token)
            try:
                client.verify_credentials()
            except Exception as e:
                raise forms.ValidationError(f"Failed to verify Twilio credentials: {str(e)}")

        return cleaned_data


class TwilioIntegration(IntegrationInstallation):
    provider_slug = IntegrationProviderSlug.TWILIO

    @property
    def integration_name(self) -> str:
        return "twilio"

    def get_client(self) -> TwilioApiClient:
        return TwilioApiClient(self.model)

    def send_sms(self, to: str | list[str], body: str) -> None:
        """Send SMS to one or more recipients."""
        client = self.get_client()

        # Ensure body fits within SMS length limit
        if len(body) > MAX_SMS_LENGTH:
            body = body[: MAX_SMS_LENGTH - 3] + "..."

        # Convert single recipient to list
        if isinstance(to, str):
            to = [to]

        errors = []
        for recipient in to:
            try:
                recipient = clean_phone(recipient)
                client.send_sms(to=recipient, body=body)
            except Exception as e:
                logger.exception(
                    "twilio.send_sms.error",
                    extra={
                        "integration_id": self.model.id,
                        "recipient": recipient,
                        "error": str(e),
                    },
                )
                errors.append(e)

        if errors:
            raise IntegrationError(f"Failed to send SMS: {errors[0]}")


class InstallationConfigView(PipelineView[IntegrationPipeline]):
    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
        if request.method == "POST":
            form = TwilioConfigurationForm(request.POST)
            if form.is_valid():
                form_data = form.cleaned_data

                # Store the configuration data in the pipeline state
                pipeline.bind_state("installation_data", form_data)

                logger.info(
                    "twilio.setup.installation-config-view.success",
                    extra={
                        "account_sid": form_data.get("account_sid"),
                        "has_default_recipients": bool(form_data.get("sms_to")),
                    },
                )

                return pipeline.next_step()
        else:
            form = TwilioConfigurationForm()

        return render_to_response(
            template="sentry/integrations/twilio-config.html",
            context={"form": form},
            request=request,
        )


class TwilioIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.TWILIO.value
    name = "Twilio"
    metadata = metadata
    integration_cls = TwilioIntegration

    features = frozenset(
        [
            IntegrationFeatures.MOBILE,
            IntegrationFeatures.ALERT_RULE,
        ]
    )

    setup_dialog_config = {"width": 600, "height": 700}

    def get_pipeline_views(self) -> Sequence[PipelineView[IntegrationPipeline]]:
        return [InstallationConfigView()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        installation_data = state.get("installation_data", {})

        account_sid = installation_data.get("account_sid", "")
        messaging_service_sid = installation_data.get("messaging_service_sid", "")
        sms_from = installation_data.get("sms_from", "")
        sms_to = installation_data.get("sms_to", "")

        # Parse SMS recipients into list
        sms_to_list = []
        if sms_to:
            sms_to_list = sms_to.split(",")

        return {
            "name": f"Twilio ({account_sid})",
            "external_id": account_sid,
            "metadata": {
                "account_sid": account_sid,
                "auth_token": installation_data.get("auth_token", ""),
                "messaging_service_sid": messaging_service_sid,
                "sms_from": sms_from,
                "sms_to": sms_to_list,
            },
        }

    def post_install(
        self, integration: Integration, organization: Organization, extra: Any  # noqa: ARG002
    ) -> None:
        """Called after the integration is installed."""
        logger.info(
            "twilio.post_install",
            extra={
                "organization_id": organization.id,
                "integration_id": integration.id,
                "account_sid": integration.metadata.get("account_sid"),
            },
        )
