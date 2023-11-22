from rest_framework import status

from sentry.models.projectteam import ProjectTeam
from sentry.models.rule import Rule
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


class ProjectTeamDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-team-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


@region_silo_test
class ProjectTeamDetailsPostTest(ProjectTeamDetailsTest):
    method = "post"

    def test_add_team(self):
        project = self.create_project()
        team = self.create_team()

        self.get_success_response(
            project.organization.slug,
            project.slug,
            team.slug,
            status_code=status.HTTP_201_CREATED,
        )

        assert ProjectTeam.objects.filter(project=project, team=team).exists()

    def test_add_team_not_found(self):
        project = self.create_project()

        response = self.get_error_response(
            project.organization.slug,
            project.slug,
            "not-a-team",
            status_code=status.HTTP_404_NOT_FOUND,
        )

        assert response.data["detail"] == "Team does not exist."

    @with_feature("organizations:team-roles")
    def test_add_team_with_team_role(self):
        user = self.create_user(username="foo")
        team_to_add = self.create_team(organization=self.organization)
        team_1 = self.create_team(organization=self.organization, slug="admin-team")
        team_2 = self.create_team(organization=self.organization, slug="contri-team")
        project_1 = self.create_project(organization=self.organization, teams=[team_1])
        project_2 = self.create_project(organization=self.organization, teams=[team_2])

        self.create_member(user=user, organization=self.organization, role="member")
        self.create_team_membership(user=user, team=team_1, role="admin")
        self.create_team_membership(user=user, team=team_2)
        self.login_as(user=user)

        # Team Admin grant access to other teams
        self.get_success_response(
            self.organization.slug,
            project_1.slug,
            team_to_add.slug,
            status_code=status.HTTP_201_CREATED,
        )

        # Team Contributor cannot grant access to other teams
        self.get_error_response(
            self.organization.slug,
            project_2.slug,
            team_to_add.slug,
            status_code=status.HTTP_403_FORBIDDEN,
        )


@region_silo_test
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

        self.get_success_response(
            project.organization.slug,
            project.slug,
            team.slug,
            status_code=status.HTTP_200_OK,
        )
        assert not ProjectTeam.objects.filter(project=project, team=team).exists()

        r1.refresh_from_db()
        r2.refresh_from_db()
        ar1.refresh_from_db()
        ar2.refresh_from_db()

        assert r1.owner == ar1.owner is None
        assert r2.owner == ar2.owner == team.actor

        self.get_success_response(
            project.organization.slug,
            another_project.slug,
            team.slug,
            status_code=status.HTTP_200_OK,
        )

        r1.refresh_from_db()
        r2.refresh_from_db()
        ar1.refresh_from_db()
        ar2.refresh_from_db()

        assert r1.owner == r2.owner == ar1.owner == ar2.owner is None

    def test_remove_team_not_found(self):
        project = self.create_project()

        response = self.get_error_response(
            project.organization.slug,
            project.slug,
            "not-a-team",
            status_code=status.HTTP_404_NOT_FOUND,
        )

        assert response.data["detail"] == "Team does not exist."

    @with_feature("organizations:team-roles")
    def test_remove_team_with_team_role(self):
        user = self.create_user(username="foo")
        team_to_remove = self.create_team(organization=self.organization)
        team_1 = self.create_team(organization=self.organization, slug="admin-team")
        team_2 = self.create_team(organization=self.organization, slug="contri-team")
        project_1 = self.create_project(
            organization=self.organization, teams=[team_1, team_to_remove]
        )
        project_2 = self.create_project(
            organization=self.organization, teams=[team_2, team_to_remove]
        )

        self.create_member(user=user, organization=self.organization, role="member")
        self.create_team_membership(user=user, team=team_1, role="admin")
        self.create_team_membership(user=user, team=team_2)
        self.login_as(user=user)

        # Cannot revoke access for other team if you are not their admin
        self.get_error_response(
            self.organization.slug,
            project_1.slug,
            team_to_remove.slug,
            status_code=status.HTTP_403_FORBIDDEN,
        )

        # Can revoke access for your own team
        self.get_success_response(
            self.organization.slug,
            project_1.slug,
            team_1.slug,
            status_code=status.HTTP_200_OK,
        )

        # Cannot revoke access as a team contributor
        self.get_error_response(
            self.organization.slug,
            project_2.slug,
            team_to_remove.slug,
            status_code=status.HTTP_403_FORBIDDEN,
        )
