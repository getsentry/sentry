from urllib.parse import urlparse

from sentry.integrations.slack.views.link_team import build_team_linking_url
from sentry.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.models.integrations.external_actor import ExternalActor
from sentry.models.integrations.integration import Integration
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test
from sentry.types.integrations import ExternalProviders


@no_silo_test(stable=True)
class SlackLinkTeamTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=self.user)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.member = self.create_member(
            user=None,
            email="bar@example.com",
            organization=self.org,
            role="owner",
            teams=[self.team],
        )
        self.create_team_membership(user=self.user, team=self.team)
        self.integration = Integration.objects.create(
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        self.integration.add_organization(self.org, self.user)
        self.idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        self.identity = Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=self.idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        linking_url = urlparse(
            build_team_linking_url(
                self.integration,
                "UXXXXXXX1",
                "CXXXXXXX9",
                "general",
                "http://example.slack.com/response_url",
            )
        )
        self.path = linking_url.path

    def test_link_team(self):
        self.login_as(self.user)
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.click('[name="team"]')
        self.browser.click(f'[value="{self.team.id}"]')
        self.browser.click('[type="submit"]')
        self.browser.wait_until_not(".loading")

        assert ExternalActor.objects.filter(
            team_id=self.team.id,
            organization=self.org,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name="general",
            external_id="CXXXXXXX9",
        ).exists()
