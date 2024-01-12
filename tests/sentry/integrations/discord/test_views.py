from unittest import mock

from django.core.signing import SignatureExpired

from sentry.integrations.discord.views.link_identity import build_linking_url
from sentry.integrations.discord.views.unlink_identity import build_unlinking_url
from sentry.models.identity import Identity, IdentityStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


class DiscordIntegrationLinkIdentityTestBase(TestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.guild_id = "guild-id"
        self.discord_user_id = "user1234"
        self.discord_integration = self.create_integration(
            provider="discord",
            name="Cool server",
            external_id=self.guild_id,
            organization=self.organization,
        )
        self.provider = self.create_identity_provider(integration=self.discord_integration)


@control_silo_test
class DiscordIntegrationLinkIdentityTest(DiscordIntegrationLinkIdentityTestBase):
    def test_basic_flow(self):
        url = build_linking_url(self.discord_integration, self.discord_user_id)  # type: ignore
        response = self.client.get(url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/auth-link-identity.html")

        response = self.client.post(url)

        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/integrations/discord/linked.html")

        identity = Identity.objects.filter(external_id=self.discord_user_id, user=self.user)

        assert len(identity) == 1
        assert identity[0].idp == self.provider
        assert identity[0].status == IdentityStatus.VALID

    @mock.patch("sentry.integrations.discord.views.link_identity.unsign")
    def test_expired_signature(self, mock_sign):
        mock_sign.side_effect = SignatureExpired
        url = build_linking_url(self.discord_integration, self.discord_user_id)  # type: ignore
        response = self.client.get(url)
        self.assertTemplateUsed(response, "sentry/integrations/discord/expired-link.html")


@control_silo_test
class DiscordIntegrationUnlinkIdentityTest(DiscordIntegrationLinkIdentityTestBase):
    def setUp(self):
        super().setUp()
        self.identity = self.create_identity(self.user, self.provider, self.discord_user_id)

    def test_basic_flow(self):
        url = build_unlinking_url(self.discord_integration, self.discord_user_id)  # type: ignore
        response = self.client.get(url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/auth-unlink-identity.html")

        response = self.client.post(url)

        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/integrations/discord/unlinked.html")

        assert not Identity.objects.filter(
            external_id=self.discord_user_id, user=self.user
        ).exists()

    @mock.patch("sentry.integrations.discord.views.unlink_identity.unsign")
    def test_expired_signature(self, mock_sign):
        mock_sign.side_effect = SignatureExpired
        url = build_unlinking_url(self.discord_integration, self.discord_user_id)  # type: ignore
        response = self.client.get(url)
        self.assertTemplateUsed(response, "sentry/integrations/discord/expired-link.html")
