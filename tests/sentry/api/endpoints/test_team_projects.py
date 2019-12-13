from __future__ import absolute_import

import six

from sentry.models import Project, Rule
from sentry.testutils import APITestCase


class TeamProjectsListTest(APITestCase):
    def test_simple(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team1 = self.create_team(organization=org, name="foo")
        project1 = self.create_project(organization=org, teams=[team1])
        team2 = self.create_team(organization=org, name="bar")
        self.create_project(organization=org, teams=[team2])

        path = u"/api/0/teams/{}/{}/projects/".format(org.slug, team1.slug)

        self.login_as(user=user)

        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(project1.id)


class TeamProjectsCreateTest(APITestCase):
    def test_with_default_rules(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team1 = self.create_team(organization=org, name="foo")

        path = u"/api/0/teams/{}/{}/projects/".format(org.slug, team1.slug)

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

        path = u"/api/0/teams/{}/{}/projects/".format(org.slug, team1.slug)

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

        path = u"/api/0/teams/{}/{}/projects/".format(org.slug, team1.slug)

        self.login_as(user=user)

        response = self.client.post(path, data={"name": "Test Project", "slug": "test-project"})

        assert response.status_code == 409, response.content

    def test_with_invalid_platform(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team1 = self.create_team(organization=org, name="foo")

        path = u"/api/0/teams/{}/{}/projects/".format(org.slug, team1.slug)

        self.login_as(user=user)

        response = self.client.post(
            path, data={"name": "Test Project", "slug": "test-project", "platform": "lol"}
        )
        assert response.status_code == 400, response.content
