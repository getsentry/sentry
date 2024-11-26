from unittest import mock

from sentry.integrations.discord.message_builder.base.flags import EPHEMERAL_FLAG
from sentry.integrations.discord.requests.base import DiscordRequestTypes
from sentry.integrations.discord.webhooks.command import HELP_MESSAGE, NOT_LINKED_MESSAGE
from sentry.integrations.discord.webhooks.types import DiscordResponseTypes
from sentry.integrations.messaging.metrics import MessageCommandFailureReason
from sentry.integrations.types import EventLifecycleOutcome
from sentry.testutils.cases import APITestCase
from tests.sentry.integrations.utils.test_assert_metrics import assert_failure_metric

WEBHOOK_URL = "/extensions/discord/interactions/"


class DiscordCommandInteractionTest(APITestCase):
    @mock.patch("sentry.integrations.discord.requests.base.verify_signature")
    def test_command_interaction(self, mock_verify_signature):
        mock_verify_signature.return_value = True
        response = self.client.post(
            path=WEBHOOK_URL,
            data={"type": 2, "data": {"name": "command_name"}},
            format="json",
            HTTP_X_SIGNATURE_ED25519="signature",
            HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
        )
        data = response.json()
        assert data["type"] == DiscordResponseTypes.MESSAGE
        assert HELP_MESSAGE in data["data"]["content"]
        assert data["data"]["flags"] == EPHEMERAL_FLAG
        assert response.status_code == 200

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_no_integration(self, mock_record):
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
        assert resp.status_code == 200

        start, failure = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert failure.args[0] == EventLifecycleOutcome.FAILURE
        assert_failure_metric(mock_record, MessageCommandFailureReason.MISSING_DATA.value)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_no_user_id(self, mock_record):
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
        assert resp.status_code == 200

        start, failure = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert failure.args[0] == EventLifecycleOutcome.FAILURE
        assert_failure_metric(mock_record, MessageCommandFailureReason.MISSING_DATA.value)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_guild(self, mock_record):
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
            response = self.client.post(
                path=WEBHOOK_URL,
                data={
                    "type": DiscordRequestTypes.COMMAND,
                    "data": {"name": "link", "type": 1},
                    "guild_id": guild_id,
                    "channel_id": "channel-id",
                    "member": {"user": {"id": "user1234"}},
                },
                format="json",
                HTTP_X_SIGNATURE_ED25519="signature",
                HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
            )
            data = response.json()
            assert data["type"] == DiscordResponseTypes.MESSAGE
            assert data["data"]["content"].endswith(
                "to link your Discord account to your Sentry account."
            )
            assert data["data"]["flags"] == EPHEMERAL_FLAG
            assert response.status_code == 200

        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_dm(self, mock_record):
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
            response = self.client.post(
                path=WEBHOOK_URL,
                data={
                    "type": DiscordRequestTypes.COMMAND,
                    "data": {"name": "link", "type": 1},
                    "channel_id": "channel-id",
                    # user object is sent when the command is invoked in a DM
                    "user": {"id": "user1234"},
                },
                format="json",
                HTTP_X_SIGNATURE_ED25519="signature",
                HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
            )
            data = response.json()
            assert data["type"] == DiscordResponseTypes.MESSAGE
            assert data["data"]["content"].endswith(
                "to link your Discord account to your Sentry account."
            )
            assert data["data"]["flags"] == EPHEMERAL_FLAG
            assert response.status_code == 200

        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_already_linked(self, mock_record):
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
            response = self.client.post(
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
            data = response.json()
            assert data["type"] == DiscordResponseTypes.MESSAGE
            assert data["data"]["content"].startswith(
                "You are already linked to the Sentry account with email:"
            )
            assert data["data"]["flags"] == EPHEMERAL_FLAG
            assert response.status_code == 200

        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unlink_no_identity(self, mock_record):
        with mock.patch(
            "sentry.integrations.discord.requests.base.verify_signature", return_value=True
        ):
            response = self.client.post(
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
            data = response.json()
            assert data["type"] == DiscordResponseTypes.MESSAGE
            assert data["data"]["content"] == NOT_LINKED_MESSAGE
            assert data["data"]["flags"] == EPHEMERAL_FLAG
            assert response.status_code == 200

        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unlink(self, mock_record):
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
            response = self.client.post(
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

            data = response.json()
            assert data["type"] == DiscordResponseTypes.MESSAGE
            assert data["data"]["content"].endswith(
                "to unlink your Discord account from your Sentry Account."
            )
            assert data["data"]["flags"] == EPHEMERAL_FLAG
            assert response.status_code == 200

        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_help(self, mock_record):
        with mock.patch(
            "sentry.integrations.discord.requests.base.verify_signature", return_value=True
        ):
            response = self.client.post(
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
            data = response.json()
            assert data["type"] == DiscordResponseTypes.MESSAGE
            assert HELP_MESSAGE in data["data"]["content"]
            assert data["data"]["flags"] == EPHEMERAL_FLAG
            assert response.status_code == 200

        assert len(mock_record.mock_calls) == 2
        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS
