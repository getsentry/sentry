from typing import Any, Optional
from unittest import mock

import responses

from sentry.constants import ObjectStatus
from sentry.integrations.discord.client import DiscordClient
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.organization import Organization
from sentry.models.scheduledeletion import ScheduledDeletion
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import Factories
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

GUILD_ID = "guild-id"
LEAVE_GUILD_URL = (
    f"{DiscordClient.base_url}{DiscordClient.USERS_GUILD_URL.format(guild_id=GUILD_ID)}"
)


@control_silo_test(stable=True)
class DiscordUninstallTest(APITestCase):
    endpoint = "sentry-api-0-organization-integration-details"
    method = "delete"

    def setUp(self) -> None:
        self.integration = self.create_discord_integration(self.organization, self.user)
        self.login_as(self.user)
        return

    def create_discord_integration(
        self,
        organization: Organization,
        user: Optional[RpcUser],
        guild_id: str = GUILD_ID,
        **kwargs: Any,
    ):
        if user is None:
            with assume_test_silo_mode(SiloMode.REGION):
                user = organization.get_default_owner()

        integration = Factories.create_integration(
            provider="discord",
            name="Cool server",
            external_id=guild_id,
            organization=organization,
            **kwargs,
        )

        return integration

    def uninstall(self):
        org_integration = OrganizationIntegration.objects.get(
            integration=self.integration, organization_id=self.organization.id
        )

        with self.tasks():
            self.get_success_response(self.organization.slug, self.integration.id)

        assert Integration.objects.filter(id=self.integration.id).exists()

        assert not OrganizationIntegration.objects.filter(
            integration=self.integration,
            organization_id=self.organization.id,
            status=ObjectStatus.ACTIVE,
        ).exists()

        assert ScheduledDeletion.objects.filter(
            model_name="OrganizationIntegration",
            object_id=org_integration.id,
        ).exists()

    def mock_discord_guild_leave(self, status: int = 204):
        responses.add(
            responses.DELETE,
            url=f"{DiscordClient.base_url}{DiscordClient.USERS_GUILD_URL.format(guild_id=GUILD_ID)}",
            status=status,
        )

    def assert_leave_guild_api_call_count(self, count: int):
        assert responses.assert_call_count(count=count, url=LEAVE_GUILD_URL)

    @responses.activate
    def test_uninstall(self):
        self.mock_discord_guild_leave()
        self.uninstall()
        self.assert_leave_guild_api_call_count(1)

    @responses.activate
    def test_uninstall_bot_already_left_guild(self):
        self.mock_discord_guild_leave(status=404)
        self.uninstall()
        self.assert_leave_guild_api_call_count(1)

    @responses.activate
    @mock.patch("sentry.integrations.discord.integration.logger.error")
    def test_uninstall_unexpected_failure(self, mock_log_error):
        self.mock_discord_guild_leave(status=500)
        self.uninstall()
        self.assert_leave_guild_api_call_count(1)
        assert mock_log_error.call_count == 1

    @responses.activate
    def test_uninstall_multiple_orgs(self):
        self.mock_discord_guild_leave()

        other_org = self.create_organization(owner=self.user)
        self.integration.add_organization(other_org)

        self.uninstall()

        # Make sure other org integration persists and we did not make an
        # attempt to uninstall the bot from the shared server
        assert Integration.objects.filter(id=self.integration.id).exists()
        assert OrganizationIntegration.objects.filter(
            integration=self.integration, organization_id=other_org.id
        ).exists()
        self.assert_leave_guild_api_call_count(0)
