from django.urls import reverse

from sentry.models import Project, Rule
from sentry.testutils import APITestCase


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


class TeamProjectsCreateTest(APITestCase):
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

        assert Rule.objects.filter(project=project).exists()

    def test_without_default_rules(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team1 = self.create_team(organization=org, name="foo")

        path = f"/api/0/teams/{org.slug}/{team1.slug}/projects/"

        self.login_as(user=user)

        response = self.client.post(path, data={"name": "Test Project", "default_rules": False})

        assert response.status_code == 201, response.content
        project = Project.objects.get(id=response.data["id"])
        assert project.name == "Test Project"
        assert project.slug

        assert not Rule.objects.filter(project=project).exists()

    def test_with_duplicate_explicit_slug(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team1 = self.create_team(organization=org, name="foo")
        self.create_project(organization=org, teams=[team1], slug="test-project")

        path = f"/api/0/teams/{org.slug}/{team1.slug}/projects/"

        self.login_as(user=user)

        response = self.client.post(path, data={"name": "Test Project", "slug": "test-project"})

        assert response.status_code == 409, response.content

    def test_with_invalid_platform(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team1 = self.create_team(organization=org, name="foo")

        path = f"/api/0/teams/{org.slug}/{team1.slug}/projects/"

        self.login_as(user=user)

        response = self.client.post(
            path, data={"name": "Test Project", "slug": "test-project", "platform": "lol"}
        )
        assert response.status_code == 400, response.content
