from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import OrganizationMember, OrganizationMemberTeam, Team
from sentry.testutils import APITestCase


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

    def test_teams_without_membership(self):
        user = self.create_user()
        org = self.create_organization(owner=self.user)
        team1 = self.create_team(organization=org, name="foo")
        team2 = self.create_team(organization=org, name="bar")
        team3 = self.create_team(organization=org, name="baz")

        self.create_member(organization=org, user=user, has_global_access=False, teams=[team1])

        path = f"/api/0/organizations/{org.slug}/teams/?is_not_member=1"

        self.login_as(user=user)

        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["id"] == str(team2.id)
        assert not response.data[0]["isMember"]
        assert response.data[1]["id"] == str(team3.id)
        assert not response.data[1]["isMember"]

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


class OrganizationTeamsCreateTest(APITestCase):
    endpoint = "sentry-api-0-organization-teams"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @fixture
    def path(self):
        return reverse("sentry-api-0-organization-teams", args=[self.organization.slug])

    def test_missing_permission(self):
        user = self.create_user()
        self.login_as(user=user)

        self.get_valid_response(self.organization.slug, status_code=403)

    def test_missing_params(self):
        resp = self.get_valid_response(self.organization.slug, status_code=400)
        assert b"Name or slug is required" in resp.content

    def test_valid_params(self):
        resp = self.get_valid_response(
            self.organization.slug, name="hello world", slug="foobar", status_code=201
        )

        team = Team.objects.get(id=resp.data["id"])
        assert team.name == "hello world"
        assert team.slug == "foobar"
        assert team.organization == self.organization

        member = OrganizationMember.objects.get(user=self.user, organization=self.organization)

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member, team=team, is_active=True
        ).exists()

    def test_without_slug(self):
        resp = self.get_valid_response(self.organization.slug, name="hello world", status_code=201)

        team = Team.objects.get(id=resp.data["id"])
        assert team.slug == "hello-world"

    def test_without_name(self):
        resp = self.get_valid_response(self.organization.slug, slug="example-slug", status_code=201)

        team = Team.objects.get(id=resp.data["id"])
        assert team.slug == "example-slug"
        assert team.name == "example-slug"

    def test_duplicate(self):
        self.get_valid_response(
            self.organization.slug, name="hello world", slug="foobar", status_code=201
        )
        self.get_valid_response(
            self.organization.slug, name="hello world", slug="foobar", status_code=409
        )

    def test_name_too_long(self):
        self.get_valid_response(
            self.organization.slug, name="x" * 65, slug="xxxxxxx", status_code=400
        )
