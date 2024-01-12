from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectManagerTest(TestCase):
    def test_get_for_user_ids(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        self.create_team_membership(team, user=user)
        project = self.create_project(teams=[team], name="name")

        projects = Project.objects.get_for_user_ids({user.id})
        assert list(projects) == [project]

    def test_get_for_user(self):
        user = self.create_user("foo@example.com")
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        project = self.create_project(teams=[team], name="foo")
        project2 = self.create_project(teams=[team], name="baz")

        result = Project.objects.get_for_user(team=team, user=user, _skip_team_check=True)
        assert result == [project2, project]

        result = Project.objects.get_for_user(team=team, user=user, _skip_team_check=False)
        assert result == []

        self.create_member(organization=org, user=user, teams=[team])

        # check again after creating member
        result = Project.objects.get_for_user(team=team, user=user, _skip_team_check=True)
        assert result == [project2, project]

        result = Project.objects.get_for_user(team=team, user=user, _skip_team_check=False)
        assert result == [project2, project]

        # test with scope user doesn't have
        result = Project.objects.get_for_user(
            team=team, user=user, _skip_team_check=False, scope="project:write"
        )
        assert result == []

        # check with scope they do have
        result = Project.objects.get_for_user(
            team=team, user=user, _skip_team_check=False, scope="project:read"
        )
        assert result == [project2, project]

    def test_get_by_users_empty(self):
        assert Project.objects.get_by_users([]) == {}
        assert Project.objects.get_by_users([self.user]) == {}

    def test_get_by_users(self):
        organization = self.create_organization()

        user1 = self.create_user("foo@example.com")
        user2 = self.create_user("foo2@example.com")

        team1 = self.create_team(organization=organization, name="team_1")
        self.create_member(user=user1, organization=organization, teams=[team1])
        team2 = self.create_team(organization=organization, name="team_2")
        self.create_member(user=user2, organization=organization, teams=[team2])

        project1 = self.create_project(teams=[team1], name="foo")
        project2 = self.create_project(teams=[team1, team2], name="baz")
        self.create_project(organization=organization, name="no_teams")

        assert Project.objects.get_by_users({user1}) == {user1.id: {project1.id, project2.id}}
        assert Project.objects.get_by_users({user2}) == {user2.id: {project2.id}}
        assert Project.objects.get_by_users({user1, user2}) == {
            user1.id: {project1.id, project2.id},
            user2.id: {project2.id},
        }
