from __future__ import absolute_import

import six

from sentry.models import Project, ProjectStatus, SentryAppInstallationToken
from sentry.testutils import APITestCase


class ProjectsListTest(APITestCase):
    path = "/api/0/projects/"

    def test_member_constraints(self):
        user = self.create_user(is_superuser=True)
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        project = self.create_project(teams=[team])
        org2 = self.create_organization()
        team2 = self.create_team(organization=org2, members=[])
        self.create_project(teams=[team2])

        self.login_as(user=user, superuser=True)
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]["id"] == six.text_type(project.id)
        assert response.data[0]["organization"]["id"] == six.text_type(org.id)

    def test_show_all_with_superuser(self):
        Project.objects.all().delete()

        user = self.create_user(is_superuser=True)

        org = self.create_organization(owner=user)
        self.create_project(organization=org)

        org2 = self.create_organization()
        self.create_project(organization=org2)

        self.login_as(user=user, superuser=True)
        response = self.client.get(u"{}?show=all".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 2

    def test_show_all_without_superuser(self):
        Project.objects.all().delete()

        user = self.create_user(is_superuser=False)

        org = self.create_organization(owner=user)
        self.create_project(organization=org)

        org2 = self.create_organization()
        self.create_project(organization=org2)

        self.login_as(user=user)
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_status_filter(self):
        Project.objects.all().delete()

        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        project1 = self.create_project(teams=[team])
        project2 = self.create_project(teams=[team], status=ProjectStatus.PENDING_DELETION)

        self.login_as(user=user)

        response = self.client.get(self.path + "?status=active")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(project1.id)

        response = self.client.get(self.path + "?status=deleted")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(project2.id)

    def test_query_filter(self):
        Project.objects.all().delete()

        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        project1 = self.create_project(name="foo", teams=[team])
        self.create_project(name="bar", teams=[team])

        self.login_as(user=user)

        response = self.client.get(self.path + "?query=foo")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(project1.id)

        response = self.client.get(self.path + "?query=baz")
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_slug_query(self):
        Project.objects.all().delete()

        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        project1 = self.create_project(slug="foo", name="foo", teams=[team])
        self.create_project(name="bar", slug="bar", teams=[team])

        self.login_as(user=user)

        response = self.client.get(self.path + "?query=slug:foo")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(project1.id)

        response = self.client.get(self.path + "?query=slug:baz")
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_id_query(self):
        Project.objects.all().delete()

        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        project1 = self.create_project(teams=[team])
        self.create_project(teams=[team])

        self.login_as(user=user)

        response = self.client.get(u"{}?query=id:{}".format(self.path, project1.id))
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(project1.id)

        response = self.client.get(u"{}?query=id:-1".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_valid_with_internal_integration(self):
        project = self.create_project(organization=self.organization, teams=[self.team])
        self.create_internal_integration(
            name="my_app",
            organization=self.organization,
            scopes=("project:read",),
            webhook_url="http://example.com",
        )
        # there should only be one record created so just grab the first one
        token = SentryAppInstallationToken.objects.first()
        response = self.client.get(
            u"{}".format(self.path), HTTP_AUTHORIZATION=u"Bearer {}".format(token.api_token.token)
        )
        assert project.name.encode("utf-8") in response.content
