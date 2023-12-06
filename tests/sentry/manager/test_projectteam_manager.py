from sentry.models.projectteam import ProjectTeam
from sentry.models.team import Team
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TeamManagerTest(TestCase):
    def test_simple(self):
        user = self.create_user("foo@example.com")
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user=user, teams=[team])
        ProjectTeam.objects.create(team=team, project=self.project)

        teams = Team.objects.get_for_user(organization=org, user=user)
        ProjectTeam.objects.get_for_teams_with_org_cache(teams)
