from typing import int, cast
from unittest.mock import patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class OrganizationIntegrationChannelsTest(APITestCase):
    endpoint = "sentry-api-0-organization-integration-channels"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)


@control_silo_test
class OrganizationIntegrationChannelsSlackTest(OrganizationIntegrationChannelsTest):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            name="Slack Workspace",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxb-token",
                "installation_type": "born_as_bot",
            },
        )

    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.conversations_list")
    def test_slack_channels_list(self, mock_conversations_list):
        channels = [
            {"id": "C123", "name": "general", "is_private": False},
            {"id": "C124", "name": "random", "is_private": True},
            {"id": "C125", "name": "alerts", "is_private": False},
        ]
        mock_conversations_list.return_value.data = {
            "ok": True,
            "channels": channels,
        }
        resp = self.get_success_response(self.organization.slug, self.integration.id)
        results = resp.data["results"]
        assert len(results) == 3
        for i, ch in enumerate(channels):
            expected_type = "private" if ch.get("is_private") else "public"
            assert results[i] == {
                "id": ch["id"],
                "name": ch["name"],
                "display": f"#{ch['name']}",
                "type": expected_type,
            }

    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.conversations_list")
    def test_large_slack_channel_list(self, mock_conversations_list):
        mock_channels = [
            {"id": f"C{i:04}", "name": f"channel-{i}", "is_private": i % 2 == 0}
            for i in range(1, 1001)
        ]
        mock_conversations_list.return_value.data = {
            "ok": True,
            "channels": mock_channels,
        }
        response = self.get_success_response(self.organization.slug, self.integration.id)
        results = response.data["results"]
        assert len(results) == 1000
        assert results[0]["id"] == "C0001"
        assert results[0]["type"] == "public"
        assert results[-1]["id"] == "C1000"
        assert results[-1]["type"] == "private"


@control_silo_test
class OrganizationIntegrationChannelsDiscordTest(OrganizationIntegrationChannelsTest):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="discord",
            name="Discord Server",
            external_id="1234567890",
        )

    @patch("sentry.integrations.discord.client.DiscordClient.get")
    def test_discord_channels_list(self, mock_get):
        mock_channels = [
            {"id": "123456", "name": "general", "type": 0},
            {"id": "789012", "name": "announcements", "type": 5},
            {"id": "345678", "name": "off-topic", "type": 0},
        ]
        mock_get.return_value = mock_channels
        response = self.get_success_response(self.organization.slug, self.integration.id)
        results = response.data["results"]
        DISCORD_CHANNEL_TYPES = {
            0: "text",
            5: "announcement",
            15: "forum",
        }
        expected = []
        for ch in mock_channels:
            channel_type = cast(int, ch["type"])  # mypy: ensure int key for map lookup
            expected.append(
                {
                    "id": ch["id"],
                    "name": ch["name"],
                    "display": f"#{ch['name']}",
                    "type": DISCORD_CHANNEL_TYPES.get(channel_type, "unknown"),
                }
            )
        assert results == expected
        mock_get.assert_called_once()


@control_silo_test
class OrganizationIntegrationChannelsMsTeamsTest(OrganizationIntegrationChannelsTest):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="msteams",
            name="MS Teams",
            external_id="19:team-id@thread.tacv2",
            metadata={
                "access_token": "token",
                "service_url": "https://smba.trafficmanager.net/amer/",
                "expires_at": 9999999999,
            },
        )

    @patch("sentry.integrations.msteams.client.MsTeamsClient.get")
    def test_msteams_channels_list(self, mock_get):
        mock_channels = {
            "conversations": [
                {"id": "19:channel1@thread.tacv2", "displayName": "Development"},
                {"id": "19:channel2@thread.tacv2", "displayName": "General"},
                {
                    "id": "19:channel3@thread.tacv2",
                    "displayName": "Testing",
                    "membershipType": "private",
                },
            ]
        }
        mock_get.return_value = mock_channels
        response = self.get_success_response(self.organization.slug, self.integration.id)
        results = response.data["results"]
        expected = []
        for ch in mock_channels["conversations"]:
            expected.append(
                {
                    "id": ch["id"],
                    "name": ch["displayName"],
                    "display": ch["displayName"],
                    "type": ch.get("membershipType", "standard"),
                }
            )
        assert results == expected
        mock_get.assert_called_once()


@control_silo_test
class OrganizationIntegrationChannelsErrorTest(OrganizationIntegrationChannelsTest):
    def test_integration_not_found(self):
        response = self.get_error_response(self.organization.slug, 9999, status_code=404)
        assert response.status_code == 404

    def test_unsupported_provider(self):
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub",
            external_id="github:1",
        )
        response = self.get_success_response(self.organization.slug, integration.id)
        assert response.data["results"] == []
        assert "not supported" in response.data["warning"]
