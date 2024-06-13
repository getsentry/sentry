from typing import Any

import pytest

from sentry.integrations.msteams import MsTeamsEvents, MsTeamsWebhookEndpoint
from sentry.testutils.cases import TestCase


class TestGeTeamInstallationRequestData(TestCase):
    def setUp(self) -> None:
        self._example_request_data = {
            "entities": [{"type": "clientInfo", "locale": "en-US"}],
            "timestamp": "2024-03-21T18:41:30.088Z",
            "action": "add",
            "recipient": {"name": "Sentry", "id": "28:8922afe2-d747-4ae9-9bce-fa2e6f4631f6"},
            "locale": "en-US",
            "channelId": "msteams",
            "from": {
                "aadObjectId": "8a9a85f5-748b-4d75-baa5-b8d2f6bfe209",
                "id": "29:1OG0nX1xCYfjz1_OSjsk4d5Ix51njAv7AMuc3fq18b0URfOSHBQs58aGFgsVJm4f--gX-EQSV8o_pbHXc-gZ9dA",
            },
            "type": "installationUpdate",
            "conversation": {
                "tenantId": "ce067f64-338d-44a0-89fb-7fc8973e254f",
                "isGroup": "True",
                "id": "19:7c8cd8b4b4ad4e73a2957e6daad706ef@thread.tacv2",
                "conversationType": "channel",
            },
            "channelData": {
                "channel": {"id": "19:7c8cd8b4b4ad4e73a2957e6daad706ef@thread.tacv2"},
                "team": {
                    "name": "Sales and Marketing",
                    "aadGroupId": "3d5d4c90-1ae9-41c7-9471-7ccd37ddb7d4",
                    "id": "19:7c8cd8b4b4ad4e73a2957e6daad706ef@thread.tacv2",
                },
                "settings": {
                    "selectedChannel": {"id": "19:7c8cd8b4b4ad4e73a2957e6daad706ef@thread.tacv2"}
                },
                "source": {"name": "message"},
                "tenant": {"id": "ce067f64-338d-44a0-89fb-7fc8973e254f"},
            },
            "serviceUrl": "https://smba.trafficmanager.net/amer/",
            "id": "f:1af81a4d-ed72-647d-c803-1681b91a7fa4",
        }

    def test_with_example_request(self) -> None:
        response = MsTeamsWebhookEndpoint._get_team_installation_request_data(
            self._example_request_data
        )
        assert response == {
            "conversation_id": "19:7c8cd8b4b4ad4e73a2957e6daad706ef@thread.tacv2",
            "external_id": "19:7c8cd8b4b4ad4e73a2957e6daad706ef@thread.tacv2",
            "external_name": "Sales and Marketing",
            "installation_type": "team",
            "service_url": "https://smba.trafficmanager.net/amer/",
            "tenant_id": "ce067f64-338d-44a0-89fb-7fc8973e254f",
            "user_id": "29:1OG0nX1xCYfjz1_OSjsk4d5Ix51njAv7AMuc3fq18b0URfOSHBQs58aGFgsVJm4f--gX-EQSV8o_pbHXc-gZ9dA",
        }

    def test_raises_error_with_missing_data(self) -> None:
        bad_request_data: dict[str, Any] = self._example_request_data.copy()
        bad_request_data["channelData"].pop("tenant", None)  # Remove "tenant" key
        with pytest.raises(KeyError):
            MsTeamsWebhookEndpoint._get_team_installation_request_data(bad_request_data)


class TestEventHandler(TestCase):
    def test_has_all_handlers(self) -> None:
        instance = MsTeamsWebhookEndpoint()
        assert len(instance._event_handlers) == 4
        assert MsTeamsEvents.INSTALLATION_UPDATE in instance._event_handlers
        assert MsTeamsEvents.UNKNOWN in instance._event_handlers
        assert MsTeamsEvents.MESSAGE in instance._event_handlers
        assert MsTeamsEvents.CONVERSATION_UPDATE in instance._event_handlers
