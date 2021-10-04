from sentry.models import Project, User
from sentry.testutils import TestCase


class ProjectManagerTest(TestCase):
    def test_get_for_user(self):
        user = User.objects.create(username="foo")
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
