from unittest import mock

from sentry.integrations.discord.requests.base import DiscordRequestTypes
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test

WEBHOOK_URL = "/extensions/discord/interactions/"


@region_silo_test(stable=True)
class DiscordCommandInteractionTest(APITestCase):
    @mock.patch("sentry.integrations.discord.requests.base.verify_signature")
    def test_command_interaction(self, mock_verify_signature):
        mock_verify_signature.return_value = True
        resp = self.client.post(
            path=WEBHOOK_URL,
            data={"type": 2, "data": {"name": "command_name"}},
            format="json",
            HTTP_X_SIGNATURE_ED25519="signature",
            HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
        )

        assert resp.status_code == 200
        assert resp.json()["type"] == 4

    def test_link_no_integration(self):
        with mock.patch(
            "sentry.integrations.discord.requests.base.verify_signature", return_value=True
        ):
            resp = self.client.post(
                path=WEBHOOK_URL,
                data={
                    "type": DiscordRequestTypes.COMMAND,
                    "data": {
                        "name": "link",
                    },
                },
                format="json",
                HTTP_X_SIGNATURE_ED25519="signature",
                HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
            )
        assert resp.status_code == 400

    def test_link_no_user_id(self):
        guild_id = "guild-id"
        self.create_integration(
            provider="discord",
            name="Cool server",
            external_id=guild_id,
            organization=self.organization,
        )
        with mock.patch(
            "sentry.integrations.discord.requests.base.verify_signature", return_value=True
        ):
            resp = self.client.post(
                path=WEBHOOK_URL,
                data={
                    "type": DiscordRequestTypes.COMMAND,
                    "data": {
                        "name": "link",
                    },
                },
                format="json",
                HTTP_X_SIGNATURE_ED25519="signature",
                HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
            )
        assert resp.status_code == 400

    def test_link(self):
        guild_id = "guild-id"
        self.create_integration(
            provider="discord",
            name="Cool server",
            external_id=guild_id,
            organization=self.organization,
        )

        with mock.patch(
            "sentry.integrations.discord.requests.base.verify_signature", return_value=True
        ):
            resp = self.client.post(
                path=WEBHOOK_URL,
                data={
                    "type": DiscordRequestTypes.COMMAND,
                    "data": {
                        "name": "link",
                    },
                    "guild_id": guild_id,
                    "channel_id": "channel-id",
                    "member": {"user": {"id": "user1234"}},
                },
                format="json",
                HTTP_X_SIGNATURE_ED25519="signature",
                HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
            )

        assert resp.status_code == 200

    def test_link_already_linked(self):
        guild_id = "guild-id"
        discord_user_id = "user1234"
        integration = self.create_integration(
            provider="discord",
            name="Cool server",
            external_id=guild_id,
            organization=self.organization,
        )
        provider = self.create_identity_provider(integration=integration)
        self.create_identity(
            user=self.user, identity_provider=provider, external_id=discord_user_id
        )

        with mock.patch(
            "sentry.integrations.discord.requests.base.verify_signature", return_value=True
        ):
            resp = self.client.post(
                path=WEBHOOK_URL,
                data={
                    "type": DiscordRequestTypes.COMMAND,
                    "data": {
                        "name": "link",
                    },
                    "guild_id": guild_id,
                    "channel_id": "channel-id",
                    "member": {
                        "user": {
                            "id": discord_user_id,
                        }
                    },
                },
                format="json",
                HTTP_X_SIGNATURE_ED25519="signature",
                HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
            )

        assert resp.status_code == 200

    def test_unlink_no_identity(self):
        with mock.patch(
            "sentry.integrations.discord.requests.base.verify_signature", return_value=True
        ):
            resp = self.client.post(
                path=WEBHOOK_URL,
                data={
                    "type": DiscordRequestTypes.COMMAND,
                    "data": {
                        "name": "unlink",
                    },
                },
                format="json",
                HTTP_X_SIGNATURE_ED25519="signature",
                HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
            )
        assert resp.status_code == 200

    def test_unlink(self):
        guild_id = "guild-id"
        discord_user_id = "user1234"
        integration = self.create_integration(
            provider="discord",
            name="Cool server",
            external_id=guild_id,
            organization=self.organization,
        )
        provider = self.create_identity_provider(integration=integration)
        self.create_identity(
            user=self.user, identity_provider=provider, external_id=discord_user_id
        )

        with mock.patch(
            "sentry.integrations.discord.requests.base.verify_signature", return_value=True
        ):
            resp = self.client.post(
                path=WEBHOOK_URL,
                data={
                    "type": DiscordRequestTypes.COMMAND,
                    "data": {
                        "name": "unlink",
                    },
                    "guild_id": guild_id,
                    "channel_id": "channel-id",
                    "member": {
                        "user": {
                            "id": discord_user_id,
                        }
                    },
                },
                format="json",
                HTTP_X_SIGNATURE_ED25519="signature",
                HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
            )

        assert resp.status_code == 200

    def test_help(self):
        with mock.patch(
            "sentry.integrations.discord.requests.base.verify_signature", return_value=True
        ):
            resp = self.client.post(
                path=WEBHOOK_URL,
                data={
                    "type": DiscordRequestTypes.COMMAND,
                    "data": {
                        "name": "help",
                    },
                },
                format="json",
                HTTP_X_SIGNATURE_ED25519="signature",
                HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
            )
        assert resp.status_code == 200
