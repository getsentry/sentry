from sentry.models import ProjectTeam
from sentry.testutils import APITestCase


class ProjectTeamDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-team-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


class ProjectTeamDetailsPostTest(ProjectTeamDetailsTest):
    method = "post"

    def test_add_team(self):
        project = self.create_project()
        team = self.create_team()

        self.get_valid_response(project.organization.slug, project.slug, team.slug, status_code=201)

        assert ProjectTeam.objects.filter(project=project, team=team).exists()

    def test_add_team_not_found(self):
        project = self.create_project()

        self.get_valid_response(
            project.organization.slug, project.slug, "not-a-team", status_code=404
        )


class ProjectTeamDetailsDeleteTest(ProjectTeamDetailsTest):
    method = "delete"

    def test_remove_team(self):
        team = self.create_team(members=[self.user])
        project = self.create_project(teams=[team])

        self.get_valid_response(project.organization.slug, project.slug, team.slug)
        assert not ProjectTeam.objects.filter(project=project, team=team).exists()

    def test_remove_team_not_found(self):
        project = self.create_project()

        self.get_valid_response(
            project.organization.slug, project.slug, "not-a-team", status_code=404
        )
