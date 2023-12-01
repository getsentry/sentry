import re
from functools import cached_property
from unittest.mock import patch

from django.urls import reverse
from django.utils.text import slugify

from sentry.api.endpoints.organization_projects_experiment import (
    OrganizationProjectsExperimentEndpoint,
    fetch_slugifed_email_username,
)
from sentry.experiments.manager import ExperimentManager
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.models.team import Team
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationProjectsExperimentCreateTest(APITestCase):
    endpoint = "sentry-api-0-organization-projects-experiment"
    method = "post"
    p1 = "project-one"
    p2 = "project-two"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.email_username = fetch_slugifed_email_username(self.user.email)
        self.t1 = f"team-{self.email_username}"
        self.mock_experiment_get = patch.object(ExperimentManager, "get", return_value=1).start()

    @cached_property
    def path(self):
        return reverse(self.endpoint, args=[self.organization.slug])

    def validate_team_with_suffix(self, team: Team):
        pattern = rf"^{self.t1}-[a-z]{{3}}$"
        return bool(re.match(pattern, team.slug)) and bool(re.match(pattern, team.name))

    def test_missing_permission(self):
        user = self.create_user()
        self.login_as(user=user)

        self.get_error_response(self.organization.slug, status_code=403)

    def test_missing_project_name(self):
        response = self.get_error_response(self.organization.slug, status_code=400)
        assert response.data == {"name": ["This field is required."]}

    def test_invalid_platform(self):
        response = self.get_error_response(
            self.organization.slug, name=self.p1, platform="invalid", status_code=400
        )
        assert response.data == {"platform": ["Invalid platform"]}

    @with_feature(["organizations:team-roles"])
    @patch.object(
        OrganizationProjectsExperimentEndpoint, "should_add_creator_to_team", return_value=False
    )
    def test_not_authenticated(self, mock_add_creator):
        response = self.get_error_response(self.organization.slug, name=self.p1, status_code=401)
        assert response.data == {"detail": "User is not authenticated"}
        mock_add_creator.assert_called_once()

    @with_feature({"organizations:team-roles": False})
    def test_missing_team_roles_flag(self):
        response = self.get_error_response(self.organization.slug, name=self.p1, status_code=404)
        assert response.data == {
            "detail": "You do not have permission to join a new team as a Team Admin."
        }

    @with_feature(["organizations:team-roles"])
    @patch("sentry.models.team.Team.objects.filter")
    def test_exceed_unique_team_slug_attempts(self, mock_filter):
        mock_filter.exists.return_value = True
        response = self.get_error_response(self.organization.slug, name=self.p1, status_code=409)
        assert response.data == {
            "detail": "Unable to create a default team for this user. Please try again.",
        }

    @with_feature(["organizations:team-roles"])
    def test_valid_params(self):
        response = self.get_success_response(self.organization.slug, name=self.p1, status_code=201)

        team = Team.objects.get(slug=self.t1, name=self.t1)
        assert not team.idp_provisioned
        assert team.organization == self.organization
        assert team.name == team.slug == self.t1

        member = OrganizationMember.objects.get(
            user_id=self.user.id, organization=self.organization
        )
        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member, team=team, is_active=True, role="admin"
        ).exists()

        project = Project.objects.get(id=response.data["id"])
        assert project.name == project.slug == self.p1
        assert project.teams.first() == team

    @with_feature(["organizations:team-roles"])
    def test_project_slug_is_slugified(self):
        unslugified_name = "not_slugged_$!@#$"
        response = self.get_success_response(
            self.organization.slug, name=unslugified_name, status_code=201
        )

        team = Team.objects.get(slug=self.t1, name=self.t1)
        assert not team.idp_provisioned
        assert team.organization == self.organization
        assert team.name == team.slug == self.t1

        member = OrganizationMember.objects.get(
            user_id=self.user.id, organization=self.organization
        )
        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member, team=team, is_active=True, role="admin"
        ).exists()

        project = Project.objects.get(id=response.data["id"])
        assert project.name == unslugified_name
        assert project.slug == slugify(unslugified_name)
        assert project.teams.first() == team

    @with_feature(["organizations:team-roles"])
    def test_team_slug_is_slugified(self):
        special_email = "test.bad$email@foo.com"
        t1 = "team-testbademail"
        user = self.create_user(email=special_email)
        self.login_as(user=user)
        self.create_member(
            user=user, organization=self.organization, role="admin", teams=[self.team]
        )

        response = self.get_success_response(self.organization.slug, name=self.p1, status_code=201)

        team = Team.objects.get(slug=t1, name=t1)
        assert not team.idp_provisioned
        assert team.organization == self.organization
        assert team.name == team.slug == t1

        member = OrganizationMember.objects.get(user_id=user.id, organization=self.organization)
        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member, team=team, is_active=True, role="admin"
        ).exists()

        project = Project.objects.get(id=response.data["id"])
        assert project.name == project.slug == self.p1
        assert project.teams.first() == team

    @with_feature(["organizations:team-roles"])
    def test_with_default_rules(self):
        response = self.get_success_response(self.organization.slug, name=self.p1, status_code=201)

        project = Project.objects.get(id=response.data["id"])
        assert project.name == project.slug == self.p1
        assert project.slug

        assert Rule.objects.filter(project=project).exists()

    @with_feature(["organizations:team-roles"])
    def test_without_default_rules(self):
        response = self.get_success_response(
            self.organization.slug, name=self.p1, default_rules=False, status_code=201
        )

        project = Project.objects.get(id=response.data["id"])
        assert project.name == project.slug == self.p1
        assert project.slug

        assert not Rule.objects.filter(project=project).exists()

    @with_feature(["organizations:team-roles"])
    def test_consecutive_reqs_adds_team_suffix(self):
        resp1 = self.get_success_response(self.organization.slug, name=self.p1, status_code=201)
        resp2 = self.get_success_response(self.organization.slug, name=self.p2, status_code=201)
        teams = Team.objects.filter(slug__icontains=self.email_username)
        assert len(teams) == 2

        if teams[0].slug == self.t1:
            team1, team2 = teams[0], teams[1]
        else:
            team1, team2 = teams[1], teams[0]

        assert team1.name == team1.slug == self.t1
        assert self.validate_team_with_suffix(team2)

        proj1 = Project.objects.get(id=resp1.data["id"])
        proj2 = Project.objects.get(id=resp2.data["id"])

        assert proj1.name == proj1.slug == self.p1
        assert proj2.name == proj2.slug == self.p2
        assert proj1.teams.first() == team1
        assert proj2.teams.first() == team2

    @with_feature(["organizations:team-roles"])
    def test_consecutive_reqs_with_duplicate_project_names(self):
        resp1 = self.get_success_response(self.organization.slug, name=self.p1, status_code=201)
        resp2 = self.get_success_response(self.organization.slug, name=self.p1, status_code=201)
        teams = Team.objects.filter(slug__icontains=self.t1)
        assert len(teams) == 2

        if teams[0].slug == self.t1:
            team1, team2 = teams[0], teams[1]
        else:
            team1, team2 = teams[1], teams[0]

        assert team1.name == team1.slug == self.t1
        assert self.validate_team_with_suffix(team2)

        proj1 = Project.objects.get(id=resp1.data["id"])
        proj2 = Project.objects.get(id=resp2.data["id"])

        assert proj1.name == proj1.slug == self.p1
        assert proj2.name == self.p1
        assert f"{self.p1}-" in proj2.slug
        assert proj1.teams.first() == team1
        assert proj2.teams.first() == team2

    @with_feature(["organizations:team-roles"])
    def test_duplicate_team_post_suffixing(self):
        self.get_success_response(
            self.organization.slug, name="hello world", slug="foobar", status_code=201
        )

        create_reference = Team.objects.create
        # Call create team with the same slug as the above request

        def create_copy(*args, **kwargs):
            kwargs["slug"] = self.t1
            return create_reference(*args, **kwargs)

        with patch.object(Team.objects, "create", side_effect=create_copy):
            response = self.get_error_response(
                self.organization.slug, name=self.p1, status_code=409
            )

        assert response.data == {
            "non_field_errors": ["A team with this slug already exists."],
            "detail": "A team with this slug already exists.",
        }

    @with_feature(["organizations:team-roles"])
    def test_member_does_not_exist(self):
        prior_team_count = Team.objects.count()

        # Multiple calls are made to OrganizationMember.objects.get, so in order to only raise
        # OrganizationMember.DoesNotExist for the correct call, we set a reference to the actual
        # function then call the reference unless the organization matches the test case
        get_reference = OrganizationMember.objects.get

        def get_callthrough(*args, **kwargs):
            if self.organization in kwargs.values():
                raise OrganizationMember.DoesNotExist
            return get_reference(*args, **kwargs)

        with patch.object(OrganizationMember.objects, "get", side_effect=get_callthrough):
            response = self.get_error_response(
                self.organization.slug, name=self.p1, status_code=403
            )
            assert response.data == {
                "detail": "You must be a member of the organization to join a new team as a Team Admin",
            }
        assert Team.objects.count() == prior_team_count
