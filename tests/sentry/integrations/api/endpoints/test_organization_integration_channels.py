from unittest.mock import patch

from sentry.testutils.cases import APITestCase


class OrganizationIntegrationChannelsTest(APITestCase):
    endpoint = "sentry-api-0-organization-integration-channels"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)


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
        """Test listing Slack channels with proper formatting and pagination."""
        channels = [
            {"id": "C123", "name": "general", "is_private": False},
            {"id": "C456", "name": "alerts", "is_private": True},
        ]
        mock_conversations_list.return_value.data = {
            "ok": True,
            "channels": channels,
            "response_metadata": {"next_cursor": "cursor123"},
        }
        resp = self.get_success_response(
            self.organization.slug, self.integration.id, qs_params={"limit": 1}
        )
        results = resp.data["results"]
        expected_first = channels[0]
        assert len(results) == 1
        assert results[0] == {
            "id": expected_first["id"],
            "name": expected_first["name"],
            "display": f"#{expected_first['name']}",
            "type": "public",
        }
        assert resp.data["nextCursor"] == "cursor123"

    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.conversations_list")
    def test_slack_channels_with_cursor(self, mock_conversations_list):
        """Test fetching next page of Slack channels with cursor."""
        channel = {"id": "C789", "name": "last-channel", "is_private": False}
        mock_conversations_list.return_value.data = {
            "ok": True,
            "channels": [channel],
            "response_metadata": {},
        }
        resp = self.get_success_response(
            self.organization.slug,
            self.integration.id,
            qs_params={"cursor": "cursor123", "limit": 2},
        )
        assert resp.data["results"] == [
            {
                "id": channel["id"],
                "name": channel["name"],
                "display": f"#{channel['name']}",
                "type": "public",
            }
        ]
        assert resp.data["nextCursor"] is None
        call_kwargs = mock_conversations_list.call_args[1]
        assert call_kwargs["cursor"] == "cursor123"


class OrganizationIntegrationChannelsDiscordTest(OrganizationIntegrationChannelsTest):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="discord",
            name="Discord Server",
            external_id="1234567890",
        )

    @patch("sentry.integrations.discord.client.DiscordClient.get_cached")
    def test_discord_channels_list(self, mock_get_cached):
        """Test listing Discord channels with client-side pagination and caching."""
        mock_channels = [
            {"id": "123456", "name": "general", "type": 0},
            {"id": "789012", "name": "announcements", "type": 5},
            {"id": "345678", "name": "off-topic", "type": 0},
        ]
        mock_get_cached.return_value = mock_channels
        response = self.get_success_response(
            self.organization.slug, self.integration.id, qs_params={"limit": 2}
        )
        results = response.data["results"]
        assert len(results) == 2
        expected = [
            {
                **mock_channels[0],
                "display": f"#{mock_channels[0]['name']}",
                "type": "text",
            },
            {
                **mock_channels[1],
                "display": f"#{mock_channels[1]['name']}",
                "type": "announcement",
            },
        ]
        assert results == expected
        mock_get_cached.assert_called_once()
        call_kwargs = mock_get_cached.call_args[1]
        assert call_kwargs["cache_time"] == 60

    @patch("sentry.integrations.discord.client.DiscordClient.get_cached")
    def test_discord_channels_pagination(self, mock_get_cached):
        """Test Discord channel pagination with offset cursor."""
        mock_get_cached.return_value = [
            {"id": "123456", "name": "general", "type": 0},
            {"id": "789012", "name": "announcements", "type": 5},
            {"id": "345678", "name": "off-topic", "type": 0},
        ]
        response = self.get_success_response(
            self.organization.slug, self.integration.id, qs_params={"cursor": "2", "limit": 2}
        )
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["id"] == "345678"
        assert response.data["nextCursor"] is None

    @patch("sentry.integrations.discord.client.DiscordClient.get_cached")
    def test_discord_filters_non_messageable_channels(self, mock_get_cached):
        """Test that Discord filters out non-messageable channel types."""
        mock_get_cached.return_value = [
            {"id": "123456", "name": "text-channel", "type": 0},
            {"id": "789012", "name": "voice-channel", "type": 2},
            {"id": "345678", "name": "category", "type": 4},
            {"id": "901234", "name": "announcement", "type": 5},
        ]

        response = self.get_success_response(self.organization.slug, self.integration.id)

        assert len(response.data["results"]) == 2
        assert response.data["results"][0]["type"] == "text"
        assert response.data["results"][1]["type"] == "announcement"


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

    @patch("sentry.integrations.msteams.client.MsTeamsClient.get_cached")
    def test_msteams_channels_list(self, mock_get_cached):
        """Test listing Microsoft Teams channels with pagination and caching."""

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
        mock_get_cached.return_value = mock_channels

        response = self.get_success_response(
            self.organization.slug, self.integration.id, qs_params={"limit": 2}
        )
        results = response.data["results"]

        expected = [
            {
                "id": ch["id"],
                "name": ch["displayName"],
                "display": ch["displayName"],
                "type": ch.get("membershipType", "standard"),
            }
            for ch in mock_channels["conversations"][:2]
        ]

        assert results == expected
        assert response.data["nextCursor"] == "2"
        mock_get_cached.assert_called_once()
        call_kwargs = mock_get_cached.call_args[1]
        assert call_kwargs["cache_time"] == 60

    @patch("sentry.integrations.msteams.client.MsTeamsClient.get_cached")
    def test_msteams_pagination(self, mock_get_cached):
        """Test MS Teams channel pagination with offset cursor."""
        mock_get_cached.return_value = {
            "conversations": [
                {"id": "19:ch1@thread.tacv2", "displayName": "First"},
                {"id": "19:ch2@thread.tacv2", "displayName": "Second"},
                {"id": "19:ch3@thread.tacv2", "displayName": "Third"},
            ]
        }

        response = self.get_success_response(
            self.organization.slug, self.integration.id, qs_params={"cursor": "2", "limit": 2}
        )

        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["name"] == "Third"
        assert response.data["nextCursor"] is None


class OrganizationIntegrationChannelsErrorTest(OrganizationIntegrationChannelsTest):
    def test_integration_not_found(self):
        """Test 404 when integration doesn't exist."""
        response = self.get_error_response(
            self.organization.slug, integration_id=9999, status_code=404
        )
        assert response.status_code == 404

    def test_unsupported_provider(self):
        """Test warning for unsupported integration provider."""
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub",
            external_id="github:1",
        )

        response = self.get_success_response(self.organization.slug, integration.id)

        assert response.data["results"] == []
        assert response.data["nextCursor"] is None
        assert "not supported" in response.data["warning"]

    def test_limit_validation(self):
        """Test limit parameter validation and clamping."""
        integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            name="Slack Workspace",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxb-token",
                "installation_type": "born_as_bot",
            },
        )

        # Test max limit clamping
        with patch("sentry.integrations.slack.sdk_client.SlackSdkClient.conversations_list") as m:
            m.return_value.data = {"ok": True, "channels": [], "response_metadata": {}}
            self.get_success_response(
                self.organization.slug, integration.id, qs_params={"limit": 999}
            )
            call_kwargs = m.call_args[1]
            assert call_kwargs["limit"] == 200

        # Test invalid limit defaults to 50
        with patch("sentry.integrations.slack.sdk_client.SlackSdkClient.conversations_list") as m:
            m.return_value.data = {"ok": True, "channels": [], "response_metadata": {}}
            self.get_success_response(
                self.organization.slug, integration.id, qs_params={"limit": "invalid"}
            )
            call_kwargs = m.call_args[1]
            assert call_kwargs["limit"] == 50
