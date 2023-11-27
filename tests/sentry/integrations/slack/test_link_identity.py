import responses

from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.integrations.slack.views.unlink_identity import build_unlinking_url
from sentry.models.identity import Identity, IdentityStatus
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import add_identity, install_slack
from sentry.testutils.silo import control_silo_test


class SlackIntegrationLinkIdentityTestBase(TestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        self.external_id = "new-slack-id"
        self.channel_id = "my-channel"
        self.response_url = "http://example.slack.com/response_url"

        self.integration = install_slack(self.organization)
        self.idp = add_identity(self.integration, self.user, self.external_id)

        responses.add(
            method=responses.POST,
            url=self.response_url,
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )


@control_silo_test
class SlackIntegrationLinkIdentityTest(SlackIntegrationLinkIdentityTestBase):
    @responses.activate
    def test_basic_flow(self):
        """Do the auth flow and assert that the identity was created."""
        linking_url = build_linking_url(
            self.integration, self.external_id, self.channel_id, self.response_url
        )

        # Load page.
        response = self.client.get(linking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/auth-link-identity.html")

        # Link identity of user
        self.client.post(linking_url)

        identity = Identity.objects.filter(external_id="new-slack-id", user=self.user)

        assert len(identity) == 1
        assert identity[0].idp == self.idp
        assert identity[0].status == IdentityStatus.VALID
        assert len(responses.calls) == 1

    @responses.activate
    def test_overwrites_existing_identities(self):
        external_id_2 = "slack-id2"

        # Create a second user.
        user2 = self.create_user(is_superuser=False)
        self.create_member(
            user=user2, organization=self.organization, role="member", teams=[self.team]
        )
        Identity.objects.create(
            user=user2, idp=self.idp, external_id=external_id_2, status=IdentityStatus.VALID
        )

        linking_url = build_linking_url(
            self.integration, external_id_2, self.channel_id, self.response_url
        )
        self.client.post(linking_url)

        assert Identity.objects.filter(external_id=external_id_2, user=self.user).exists()
        assert not Identity.objects.filter(external_id=self.external_id, user=self.user).exists()
        assert not Identity.objects.filter(external_id=external_id_2, user=user2).exists()


@control_silo_test
class SlackIntegrationUnlinkIdentityTest(SlackIntegrationLinkIdentityTestBase):
    def setUp(self):
        super().setUp()

        self.unlinking_url = build_unlinking_url(
            self.integration.id,
            self.external_id,
            self.channel_id,
            self.response_url,
        )

    @responses.activate
    def test_basic_flow(self):
        # Load page.
        response = self.client.get(self.unlinking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/auth-unlink-identity.html")

        # Unlink identity of user.
        response = self.client.post(self.unlinking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/integrations/slack/unlinked.html")

        assert not Identity.objects.filter(external_id="new-slack-id", user=self.user).exists()
        assert len(responses.calls) == 1

    @responses.activate
    def test_user_with_multiple_organizations(self):
        # Create a second organization where the user is _not_ a member.
        OrganizationIntegration.objects.create(
            organization_id=self.create_organization(name="Another Org").id,
            integration=self.integration,
        )

        # Unlink identity of user.
        self.client.post(self.unlinking_url)
        assert not Identity.objects.filter(external_id="new-slack-id", user=self.user).exists()
        assert len(responses.calls) == 1
