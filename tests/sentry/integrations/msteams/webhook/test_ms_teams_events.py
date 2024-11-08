from uuid import uuid4

from sentry.integrations.msteams import MsTeamsEvents


class TestGetFromValue:
    def test_handle_unsupported(self) -> None:
        unsupported_value = str(uuid4())
        response = MsTeamsEvents.get_from_value(unsupported_value)
        assert response == MsTeamsEvents.UNKNOWN

    def test_message(self) -> None:
        response = MsTeamsEvents.get_from_value("message")
        assert response == MsTeamsEvents.MESSAGE

    def test_installation_update(self) -> None:
        response = MsTeamsEvents.get_from_value("installationUpdate")
        assert response == MsTeamsEvents.INSTALLATION_UPDATE

    def test_conversation_update(self) -> None:
        response = MsTeamsEvents.get_from_value("conversationUpdate")
        assert response == MsTeamsEvents.CONVERSATION_UPDATE

    def test_unknown(self) -> None:
        response = MsTeamsEvents.get_from_value("unknown")
        assert response == MsTeamsEvents.UNKNOWN
