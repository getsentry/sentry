from typing import Any

from sentry.integrations.msteams import MsTeamsWebhookMixin


class TestIsNewIntegrationInstallationEvent:
    def test_valid_new_installation_event(self) -> None:
        data: dict[str, Any] = {"type": "installationUpdate", "action": "add"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is True

    def test_valid_non_installation_event(self) -> None:
        data: dict[str, Any] = {"type": "message", "action": "add"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is False

    def test_invalid_missing_type_field(self) -> None:
        data: dict[str, Any] = {"action": "add"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is False

    def test_only_required_fields(self) -> None:
        data: dict[str, Any] = {"type": "installationUpdate"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is False

    def test_additional_fields(self) -> None:
        data: dict[str, Any] = {"type": "installationUpdate", "action": "add", "extra": "field"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is True

    def test_minimum_input(self) -> None:
        data: dict[str, Any] = {"type": "installationUpdate", "action": "add"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is True

    def test_invalid_event_type(self) -> None:
        data: dict[str, Any] = {"type": "invalidType", "action": "add"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is False

    def test_invalid_action(self) -> None:
        data: dict[str, Any] = {"type": "installationUpdate", "action": "remove"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is False
