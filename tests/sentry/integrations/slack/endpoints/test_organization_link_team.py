from sentry.constants import ObjectStatus
from sentry.integrations.slack.views import SALT
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test
from sentry.utils.signing import sign

SLACK_USER_ID = "UXXXXXXX1"
CHANNEL_ID = "CXXXXXXX1"
CHANNEL_NAME = "alerts"


@cell_silo_test
class OrganizationSlackLinkTeamTest(APITestCase):
    endpoint = "sentry-api-0-organization-slack-link-team"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.team = self.create_team(organization=self.organization, members=[self.user])

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = install_slack(self.organization)

        self.signed_params = sign(
            salt=SALT,
            integration_id=self.integration.id,
            slack_id=SLACK_USER_ID,
            channel_id=CHANNEL_ID,
            channel_name=CHANNEL_NAME,
            response_url="https://hooks.slack.com/commands/response",
        )

    def login_as_team_admin(self) -> None:
        team_admin = self.create_user()
        self.create_member(
            user=team_admin,
            organization=self.organization,
            role="member",
            team_roles=[(self.team, "admin")],
        )
        self.create_team(organization=self.organization, members=[team_admin])
        self.login_as(team_admin)

    def test_lists_linkable_teams(self) -> None:
        response = self.get_success_response(self.organization.slug, self.signed_params)

        assert [team["slug"] for team in response.data] == [self.team.slug]

    def test_lists_only_administered_teams_for_team_admins(self) -> None:
        self.login_as_team_admin()

        response = self.get_success_response(self.organization.slug, self.signed_params)

        assert [team["slug"] for team in response.data] == [self.team.slug]

    def test_lists_no_teams_for_members(self) -> None:
        member = self.create_user()
        self.create_member(
            user=member, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(member)

        response = self.get_success_response(self.organization.slug, self.signed_params)

        assert response.data == []

    def test_rejects_an_invalid_link(self) -> None:
        self.get_error_response(self.organization.slug, "not-signed", status_code=400)

    def test_rejects_an_organization_without_the_workspace(self) -> None:
        other_org = self.create_organization(owner=self.user)

        self.get_error_response(other_org.slug, self.signed_params, status_code=404)

    def test_rejects_a_disabled_installation(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.organizationintegration_set.update(status=ObjectStatus.DISABLED)

        self.get_error_response(self.organization.slug, self.signed_params, status_code=404)
