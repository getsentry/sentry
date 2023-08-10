from sentry.models import Team, User
from sentry.models.projectteam import ProjectTeam
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test(stable=True)
class TeamManagerTest(TestCase):
    def test_simple(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            user = User.objects.create(username="foo")
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user=user, teams=[team])
        ProjectTeam.objects.create(team=team, project=self.project)

        teams = Team.objects.get_for_user(organization=org, user_id=user.id)
        ProjectTeam.objects.get_for_teams_with_org_cache(teams)
