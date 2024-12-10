from typing import Any

from sentry.integrations.msteams.parsing import is_new_integration_installation_event


class TestIsNewIntegrationInstallationEvent:
    def test_valid_new_installation_event(self) -> None:
        data: dict[str, Any] = {"type": "installationUpdate", "action": "add"}
        assert is_new_integration_installation_event(data) is True

    def test_valid_non_installation_event(self) -> None:
        data: dict[str, Any] = {"type": "message", "action": "add"}
        assert is_new_integration_installation_event(data) is False

    def test_invalid_missing_type_field(self) -> None:
        data: dict[str, Any] = {"action": "add"}
        assert is_new_integration_installation_event(data) is False

    def test_only_required_fields(self) -> None:
        data: dict[str, Any] = {"type": "installationUpdate"}
        assert is_new_integration_installation_event(data) is False

    def test_additional_fields(self) -> None:
        data: dict[str, Any] = {"type": "installationUpdate", "action": "add", "extra": "field"}
        assert is_new_integration_installation_event(data) is True

    def test_minimum_input(self) -> None:
        data: dict[str, Any] = {"type": "installationUpdate", "action": "add"}
        assert is_new_integration_installation_event(data) is True

    def test_invalid_event_type(self) -> None:
        data: dict[str, Any] = {"type": "invalidType", "action": "add"}
        assert is_new_integration_installation_event(data) is False

    def test_invalid_action(self) -> None:
        data: dict[str, Any] = {"type": "installationUpdate", "action": "remove"}
        assert is_new_integration_installation_event(data) is False
