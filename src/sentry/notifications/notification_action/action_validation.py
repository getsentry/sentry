from abc import ABC, abstractmethod
from collections.abc import Callable
from typing import Any

from django.core.exceptions import ValidationError
from django.forms import Form

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.slack.actions.form import SlackNotifyServiceForm
from sentry.integrations.slack.utils.channel import get_channel_id
from sentry.models.organization import Organization


def clean_validated_action_attrs(
    attrs: dict[str, Any], organization: Organization
) -> dict[str, Any]:
    type = attrs["type"]

    validator_translator = action_validator_translator_mapping.get(type)

    if not validator_translator:
        raise ValidationError(f"Validator for action type {type} not found")

    return validator_translator(attrs, organization).clean_data()


def _get_integrations(organization: Organization, provider: str) -> list[RpcIntegration]:
    return integration_service.get_integrations(
        organization_id=organization.id,
        status=ObjectStatus.ACTIVE,
        org_integration_status=ObjectStatus.ACTIVE,
        providers=[provider],
    )


class BaseActionValidatorTranslator(ABC):
    provider: str
    notify_action_form: type[Form] | None
    channel_transformer: Callable[[str, str], str] | None  # passed for Slack and MSTeams

    def __init__(self, validated_data: dict[str, Any], organization: Organization) -> None:
        self.validated_data = validated_data
        self.organization = organization

    def clean_data(self) -> dict[str, Any]:
        if self.notify_action_form is None:
            return self.validated_data

        notify_action_form = self.notify_action_form(
            data=self.generate_action_form_payload(),
            integrations=_get_integrations(self.organization, self.provider),
            channel_transformer=self.channel_transformer,
        )

        if notify_action_form.is_valid():
            return self.update_action_data(notify_action_form.cleaned_data)
        return self.validated_data

    @abstractmethod
    def generate_action_form_payload(self) -> dict[str, Any]:
        # translate validated data from BaseActionValidator to notify action form data
        pass

    @abstractmethod
    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        # update BaseActionValidator data with cleaned notify action form data
        pass


class SlackActionValidatorTranslator(BaseActionValidatorTranslator):
    from sentry.integrations.slack.actions.notification import SlackNotifyServiceAction

    provider = "slack"
    channel_transformer = get_channel_id
    notify_action_form = SlackNotifyServiceForm

    def generate_action_form_payload(self) -> dict[str, Any]:
        if not (integration_id := self.validated_data.get("integration_id")):
            raise ValidationError("Integration ID is required for Slack action")

        integration = integration_service.get_integration(integration_id=integration_id)
        if not integration:
            raise ValidationError(f"Slack integration with id {integration_id} not found")

        return {
            "workspace": integration.name,
            "channel": self.validated_data["config"]["target_display"],
            "channel_id": self.validated_data["config"].get("target_identifier"),
            "tags": self.validated_data.get("tags"),
        }

    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        self.validated_data["config"].update(
            {
                "target_display": cleaned_data["channel"],
                "target_identifier": cleaned_data["channel_id"],
            }
        )
        return self.validated_data


action_validator_translator_mapping: dict[str, type[BaseActionValidatorTranslator]] = {
    "slack": SlackActionValidatorTranslator,
}
