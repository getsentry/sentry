from sentry.models import ProjectTeam, Rule
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

        self.get_success_response(
            project.organization.slug, project.slug, team.slug, status_code=201
        )

        assert ProjectTeam.objects.filter(project=project, team=team).exists()

    def test_add_team_not_found(self):
        project = self.create_project()

        self.get_error_response(
            project.organization.slug, project.slug, "not-a-team", status_code=404
        )


class ProjectTeamDetailsDeleteTest(ProjectTeamDetailsTest):
    method = "delete"

    def test_remove_team(self):
        team = self.create_team(members=[self.user])
        project = self.create_project(teams=[team])
        another_project = self.create_project(teams=[team])

        # Associate rules with the team that also get deleted:
        # self.create_rule(name="test_rule", owner=f"team:{team.id}")
        r1 = Rule.objects.create(label="test rule", project=project, owner=team.actor)
        r2 = Rule.objects.create(
            label="another test rule", project=another_project, owner=team.actor
        )
        ar1 = self.create_alert_rule(
            name="test alert rule", owner=team.actor.get_actor_tuple(), projects=[project]
        )
        ar2 = self.create_alert_rule(
            name="another test alert rule",
            owner=team.actor.get_actor_tuple(),
            projects=[another_project],
        )

        assert r1.owner == r2.owner == ar1.owner == ar2.owner == team.actor

        self.get_success_response(project.organization.slug, project.slug, team.slug)
        assert not ProjectTeam.objects.filter(project=project, team=team).exists()

        r1.refresh_from_db()
        r2.refresh_from_db()
        ar1.refresh_from_db()
        ar2.refresh_from_db()

        assert r1.owner == ar1.owner is None
        assert r2.owner == ar2.owner == team.actor

        self.get_success_response(project.organization.slug, another_project.slug, team.slug)

        r1.refresh_from_db()
        r2.refresh_from_db()
        ar1.refresh_from_db()
        ar2.refresh_from_db()

        assert r1.owner == r2.owner == ar1.owner == ar2.owner is None

    def test_remove_team_not_found(self):
        project = self.create_project()

        self.get_error_response(
            project.organization.slug, project.slug, "not-a-team", status_code=404
        )
