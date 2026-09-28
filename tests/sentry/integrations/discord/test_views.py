from unittest import mock

from django.core.signing import SignatureExpired

from sentry.integrations.discord.views.link_identity import build_linking_url
from sentry.integrations.discord.views.unlink_identity import build_unlinking_url
from sentry.integrations.messaging.linkage import UnlinkIdentityView
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity, IdentityStatus


class DiscordIntegrationLinkIdentityTestBase(TestCase):
    def setUp(self) -> None:
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
    def test_basic_flow(self) -> None:
        url = build_linking_url(self.discord_integration, self.discord_user_id)  # type: ignore[arg-type]
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

    @mock.patch("sentry.integrations.messaging.linkage.unsign")
    def test_expired_signature(self, mock_sign: mock.MagicMock) -> None:
        mock_sign.side_effect = SignatureExpired
        url = build_linking_url(self.discord_integration, self.discord_user_id)  # type: ignore[arg-type]
        response = self.client.get(url)
        self.assertTemplateUsed(response, "sentry/integrations/discord/expired-link.html")


@control_silo_test
class DiscordIntegrationUnlinkIdentityTest(DiscordIntegrationLinkIdentityTestBase):
    def setUp(self) -> None:
        super().setUp()
        self.identity = self.create_identity(self.user, self.provider, self.discord_user_id)

    def test_basic_flow(self) -> None:
        url = build_unlinking_url(self.discord_integration, self.discord_user_id)  # type: ignore[arg-type]
        response = self.client.get(url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/auth-unlink-identity.html")

        response = self.client.post(url)

        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/integrations/discord/unlinked.html")

        assert not Identity.objects.filter(
            external_id=self.discord_user_id, user=self.user
        ).exists()

    def test_cannot_unlink_another_user(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user)
        other_identity = self.create_identity(other_user, self.provider, "other-discord-id")
        url = build_unlinking_url(self.discord_integration, self.discord_user_id)  # type: ignore[arg-type]
        self.login_as(other_user)

        with (
            mock.patch.object(UnlinkIdentityView, "notify_on_success") as notify,
            mock.patch.object(UnlinkIdentityView, "record_analytic") as record_analytic,
            mock.patch.object(UnlinkIdentityView, "_send_nudge_notification") as send_nudge,
            mock.patch.object(UnlinkIdentityView, "capture_metric") as capture_metric,
        ):
            response = self.client.post(url)

        assert response.status_code == 404
        assert Identity.objects.filter(id=self.identity.id).exists()
        assert Identity.objects.filter(id=other_identity.id).exists()
        notify.assert_not_called()
        record_analytic.assert_not_called()
        send_nudge.assert_not_called()
        assert mock.call("success.post") not in capture_metric.call_args_list

    def test_cannot_unlink_user_in_another_organization(self) -> None:
        other_user = self.create_user()
        other_organization = self.create_organization(owner=other_user)
        self.create_organization_integration(
            organization_id=other_organization.id, integration=self.discord_integration
        )
        url = build_unlinking_url(self.discord_integration, self.discord_user_id)  # type: ignore[arg-type]
        self.login_as(other_user)

        response = self.client.post(url)

        assert response.status_code == 404
        assert Identity.objects.filter(id=self.identity.id).exists()

    def test_no_identity(self) -> None:
        url = build_unlinking_url(self.discord_integration, "missing-discord-id")  # type: ignore[arg-type]

        response = self.client.post(url)

        assert response.status_code == 404
        assert Identity.objects.filter(id=self.identity.id).exists()

    def test_replayed_unlink(self) -> None:
        url = build_unlinking_url(self.discord_integration, self.discord_user_id)  # type: ignore[arg-type]
        assert self.client.post(url).status_code == 200

        with mock.patch.object(UnlinkIdentityView, "record_analytic") as record_analytic:
            response = self.client.post(url)

        assert response.status_code == 404
        record_analytic.assert_not_called()

    def test_preserves_identity_for_another_provider(self) -> None:
        other_idp = self.create_identity_provider(type="discord", external_id="other-guild")
        other_identity = self.create_identity(self.user, other_idp, self.discord_user_id)
        url = build_unlinking_url(self.discord_integration, self.discord_user_id)  # type: ignore[arg-type]

        response = self.client.post(url)

        assert response.status_code == 200
        assert not Identity.objects.filter(id=self.identity.id).exists()
        assert Identity.objects.filter(id=other_identity.id).exists()

    @mock.patch("sentry.integrations.messaging.linkage.unsign")
    def test_expired_signature(self, mock_sign: mock.MagicMock) -> None:
        mock_sign.side_effect = SignatureExpired
        url = build_unlinking_url(self.discord_integration, self.discord_user_id)  # type: ignore[arg-type]
        response = self.client.get(url)
        self.assertTemplateUsed(response, "sentry/integrations/discord/expired-link.html")
