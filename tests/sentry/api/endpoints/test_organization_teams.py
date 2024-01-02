from functools import cached_property

from django.urls import reverse

from sentry.api.fields.sentry_slug import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.projectteam import ProjectTeam
from sentry.models.team import Team
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.integrations import get_provider_string


@region_silo_test
class OrganizationTeamsListTest(APITestCase):
    def test_simple(self):
        user = self.create_user()
        org = self.create_organization(owner=self.user)
        team1 = self.create_team(organization=org, name="foo")
        team2 = self.create_team(organization=org, name="bar")

        self.create_member(organization=org, user=user, has_global_access=False, teams=[team1])

        path = f"/api/0/organizations/{org.slug}/teams/"

        self.login_as(user=user)

        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["id"] == str(team2.id)
        assert not response.data[0]["isMember"]
        assert response.data[1]["id"] == str(team1.id)
        assert response.data[1]["isMember"]

    def test_simple_results_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=self.user)
        team1 = self.create_team(organization=org, name="foo")
        self.create_team(organization=org, name="bar")

        self.create_member(organization=org, user=user, has_global_access=False, teams=[team1])

        path = f"/api/0/organizations/{org.slug}/teams/?detailed=0"

        self.login_as(user=user)

        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert "projects" not in response.data[0]
        assert "projects" not in response.data[1]

    def test_search(self):
        user = self.create_user()
        org = self.create_organization(owner=self.user)
        team = self.create_team(organization=org, name="bar", slug="bar")

        self.create_member(organization=org, user=user, has_global_access=False, teams=[team])

        self.login_as(user=user)

        path = f"/api/0/organizations/{org.slug}/teams/?query=bar"
        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(team.id)

        path = f"/api/0/organizations/{org.slug}/teams/?query=baz"
        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_list_external_teams(self):
        self.external_team = self.create_external_team(
            self.team, external_name="@getsentry/ecosystem"
        )
        path = f"/api/0/organizations/{self.organization.slug}/teams/?detailed=1"
        self.login_as(user=self.user)

        response = self.client.get(path)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.team.id)
        assert len(response.data[0]["externalTeams"]) == 1
        assert response.data[0]["externalTeams"][0] == {
            "id": str(self.external_team.id),
            "integrationId": str(self.external_team.integration_id),
            "provider": get_provider_string(self.external_team.provider),
            "externalName": self.external_team.external_name,
            "teamId": str(self.team.id),
        }

    def test_has_external_teams_query(self):
        team = self.create_team(organization=self.organization, name="foo")
        self.login_as(user=self.user)
        path = f"/api/0/organizations/{self.organization.slug}/teams/?query=hasExternalTeams:true"

        response = self.client.get(path)
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        self.create_external_team(team, external_name="@getsentry/ecosystem")

        response = self.client.get(path)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(team.id)

        path = f"/api/0/organizations/{self.organization.slug}/teams/?query=hasExternalTeams:false"
        response = self.client.get(path)
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_query_by_slug(self):
        self.create_team(organization=self.organization, name="foo")
        self.create_team(organization=self.organization, name="bar")
        self.login_as(user=self.user)

        path = f"/api/0/organizations/{self.organization.slug}/teams/?query=slug:foo"
        response = self.client.get(path)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        path = f"/api/0/organizations/{self.organization.slug}/teams/?query=slug:foo+slug:bar"
        response = self.client.get(path)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

    def test_query_by_id(self):
        team1 = self.create_team(organization=self.organization, name="foo")
        team2 = self.create_team(organization=self.organization, name="bar")
        self.login_as(user=self.user)

        path = f"/api/0/organizations/{self.organization.slug}/teams/?query=id:undefined"
        response = self.client.get(path)
        assert response.status_code == 400, response.content

        path = f"/api/0/organizations/{self.organization.slug}/teams/?query=id:{team1.id}"
        response = self.client.get(path)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        path = f"/api/0/organizations/{self.organization.slug}/teams/?query=id:{team1.id}+id:{team2.id}"
        response = self.client.get(path)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

    def test_hanging_project_team(self):
        user = self.create_user()
        org = self.create_organization(owner=self.user)
        external_org = self.create_organization()
        team1 = self.create_team(organization=org, name="foo")
        external_team = self.create_team(organization=external_org, name="bar")
        self.create_member(organization=org, user=user, has_global_access=False, teams=[team1])

        ProjectTeam.objects.create(project=self.project, team=team1)
        ProjectTeam.objects.create(project=self.project, team=external_team)

        self.login_as(user=user)
        path = f"/api/0/organizations/{org.slug}/teams/"
        response = self.client.get(path)
        assert response.status_code == 200, response.content


@region_silo_test
class OrganizationTeamsCreateTest(APITestCase):
    endpoint = "sentry-api-0-organization-teams"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @cached_property
    def path(self):
        return reverse("sentry-api-0-organization-teams", args=[self.organization.slug])

    def test_missing_permission(self):
        user = self.create_user()
        self.login_as(user=user)

        self.get_error_response(self.organization.slug, status_code=403)

    def test_missing_params(self):
        resp = self.get_error_response(self.organization.slug, status_code=400)
        assert b"Name or slug is required" in resp.content

    def test_valid_params(self):
        resp = self.get_success_response(
            self.organization.slug, name="hello world", slug="foobar", status_code=201
        )

        team = Team.objects.get(id=resp.data["id"])
        assert team.name == "hello world"
        assert team.slug == "foobar"
        assert not team.idp_provisioned
        assert team.organization == self.organization

        member = OrganizationMember.objects.get(
            user_id=self.user.id, organization=self.organization
        )

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member, team=team, is_active=True
        ).exists()

    def test_without_slug(self):
        resp = self.get_success_response(
            self.organization.slug, name="hello world", status_code=201
        )

        team = Team.objects.get(id=resp.data["id"])
        assert team.slug == "hello-world"

    def test_without_name(self):
        resp = self.get_success_response(
            self.organization.slug, slug="example-slug", status_code=201
        )

        team = Team.objects.get(id=resp.data["id"])
        assert team.slug == "example-slug"
        assert team.name == "example-slug"

    def test_with_idp_provisioned(self):
        resp = self.get_success_response(
            self.organization.slug, name="hello world", idp_provisioned=True, status_code=201
        )

        team = Team.objects.get(id=resp.data["id"])
        assert team.idp_provisioned

    def test_duplicate(self):
        self.get_success_response(
            self.organization.slug, name="hello world", slug="foobar", status_code=201
        )
        resp = self.get_error_response(
            self.organization.slug, name="hello world", slug="foobar", status_code=409
        )
        assert resp.data == {
            "non_field_errors": ["A team with this slug already exists."],
            "detail": "A team with this slug already exists.",
        }

    def test_name_too_long(self):
        self.get_error_response(
            self.organization.slug, name="x" * 65, slug="xxxxxxx", status_code=400
        )

    def test_invalid_numeric_slug(self):
        response = self.get_error_response(
            self.organization.slug, name="hello word", slug="1234", status_code=400
        )
        assert response.data["slug"][0] == DEFAULT_SLUG_ERROR_MESSAGE

    def test_generated_slug_not_entirely_numeric(self):
        response = self.get_success_response(self.organization.slug, name="1234", status_code=201)
        team = Team.objects.get(id=response.data["id"])
        assert team.slug.startswith("1234-")
        assert not team.slug.isdecimal()
