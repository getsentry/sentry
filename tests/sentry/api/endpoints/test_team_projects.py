from sentry.api.base import DEFAULT_SLUG_ERROR_MESSAGE
from django.urls import reverse

from sentry.models import Project, Rule
from sentry.notifications.types import FallthroughChoiceType
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class TeamProjectIndexTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        team = self.create_team(members=[self.user])
        project_1 = self.create_project(teams=[team], slug="fiz")
        project_2 = self.create_project(teams=[team], slug="buzz")

        url = reverse(
            "sentry-api-0-team-project-index",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["id"], response.data)) == sorted(
            [str(project_1.id), str(project_2.id)]
        )


@region_silo_test(stable=True)
class TeamProjectsListTest(APITestCase):
    def test_simple(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team1 = self.create_team(organization=org, name="foo")
        project1 = self.create_project(organization=org, teams=[team1])
        team2 = self.create_team(organization=org, name="bar")
        self.create_project(organization=org, teams=[team2])

        path = f"/api/0/teams/{org.slug}/{team1.slug}/projects/"

        self.login_as(user=user)

        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(project1.id)


@region_silo_test(stable=True)
class TeamProjectsCreateTest(APITestCase):
    endpoint = "sentry-api-0-team-project-index"
    method = "post"

    def test_simple(self):
        self.login_as(user=self.user)
        team = self.create_team(members=[self.user])
        url = reverse(
            "sentry-api-0-team-project-index",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )
        resp = self.client.post(url, data={"name": "hello world", "slug": "foobar"})
        assert resp.status_code == 201, resp.content
        project = Project.objects.get(id=resp.data["id"])
        assert project.name == "hello world"
        assert project.slug == "foobar"
        assert project.teams.first() == team

        resp = self.client.post(url, data={"name": "hello world", "slug": "foobar"})
        assert resp.status_code == 409, resp.content

    def test_with_default_rules(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team1 = self.create_team(organization=org, name="foo")

        path = f"/api/0/teams/{org.slug}/{team1.slug}/projects/"

        self.login_as(user=user)

        response = self.client.post(path, data={"name": "Test Project"})

        assert response.status_code == 201, response.content
        project = Project.objects.get(id=response.data["id"])
        assert project.name == "Test Project"
        assert project.slug

    @with_feature("app:enterprise-prevent-numeric-slugs")
    def test_invalid_numeric_slug(self):
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            name="fake name",
            slug="12345",
            status_code=400,
        )

        assert response.data["slug"][0] == DEFAULT_SLUG_ERROR_MESSAGE

    @with_feature("app:enterprise-prevent-numeric-slugs")
    def test_generated_slug_not_entirely_numeric(self):
        self.login_as(user=self.user)
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="1234",
            status_code=201,
        )

        assert response.data["slug"].startswith("1234" + "-")

    def test_with_invalid_platform(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team1 = self.create_team(organization=org, name="foo")

        path = f"/api/0/teams/{org.slug}/{team1.slug}/projects/"

        self.login_as(user=user)

        response = self.client.post(
            path, data={"name": "Test Project", "slug": "test-project", "platform": "lol"}
        )
        assert response.data["platform"][0] == "Invalid platform"

    def test_duplicate_slug(self):
        self.create_project(slug="bar")
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            status_code=409,
        )
        assert response.data["detail"] == "A project with this slug already exists."

    def test_default_rules(self):
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            default_rules=True,
            status_code=201,
        )

        project = Project.objects.get(id=response.data["id"])
        assert Rule.objects.filter(project=project).exists()

    @with_feature("organizations:issue-alert-fallback-targeting")
    def test_default_rule_fallback_targeting(self):
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            default_rules=True,
            status_code=201,
        )

        project = Project.objects.get(id=response.data["id"])
        rule = Rule.objects.filter(project=project).first()
        assert (
            rule.data["actions"][0]["fallthroughType"] == FallthroughChoiceType.ACTIVE_MEMBERS.value
        )

    def test_without_default_rules(self):
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            default_rules=False,
            status_code=201,
        )
        project = Project.objects.get(id=response.data["id"])
        assert not Rule.objects.filter(project=project).exists()
