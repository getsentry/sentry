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

    def test_conversation_update_team_member_added(self) -> None:
        # MS Teams sends a conversationUpdate + teamMemberAdded when a bot is first
        # added to a team (older bot mechanism).  There is no integration record yet,
        # so this must be treated as a new-installation event.
        data: dict[str, Any] = {
            "type": "conversationUpdate",
            "channelData": {
                "eventType": "teamMemberAdded",
                "team": {"id": "team_id", "name": "My Team"},
                "tenant": {"id": "tenant_id"},
            },
        }
        assert is_new_integration_installation_event(data) is True

    def test_conversation_update_team_member_removed(self) -> None:
        data: dict[str, Any] = {
            "type": "conversationUpdate",
            "channelData": {"eventType": "teamMemberRemoved"},
        }
        assert is_new_integration_installation_event(data) is False

    def test_conversation_update_personal_member_added(self) -> None:
        # Personal (1:1) installations arrive as a conversationUpdate with membersAdded
        # in a personal conversation.
        data: dict[str, Any] = {
            "type": "conversationUpdate",
            "conversation": {"conversationType": "personal"},
            "membersAdded": [{"id": "bot_id"}],
            "channelData": {"tenant": {"id": "tenant_id"}},
        }
        assert is_new_integration_installation_event(data) is True

    def test_conversation_update_personal_no_members_added(self) -> None:
        data: dict[str, Any] = {
            "type": "conversationUpdate",
            "conversation": {"conversationType": "personal"},
            "channelData": {"tenant": {"id": "tenant_id"}},
        }
        assert is_new_integration_installation_event(data) is False
