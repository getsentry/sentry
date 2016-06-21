from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import Project, ProjectStatus
from sentry.testutils import APITestCase


class ProjectsListTest(APITestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-0-projects')

    def test_member(self):
        user = self.create_user('foo@example.com', is_superuser=False)
        org = self.create_organization(name='foo')
        team = self.create_team(organization=org, name='foo')
        project = self.create_project(team=team, organization=org)

        self.create_member(organization=org, user=user, teams=[team])

        org2 = self.create_organization(name='bar')
        team2 = self.create_team(organization=org, name='bar')
        self.create_project(team=team2, organization=org2)

        self.login_as(user=user)
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]['id'] == str(project.id)
        assert response.data[0]['organization']['id'] == str(org.id)

    def test_superuser(self):
        Project.objects.all().delete()

        user = self.create_user('foo@example.com', is_superuser=True)

        org = self.create_organization(name='foo', owner=user)
        self.create_project(organization=org)

        org2 = self.create_organization(name='bar')
        self.create_project(organization=org2)

        self.login_as(user=user)
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert len(response.data) == 2

    def test_status_filter(self):
        Project.objects.all().delete()

        user = self.create_user('foo@example.com', is_superuser=True)

        org = self.create_organization(name='foo')
        project1 = self.create_project(organization=org)

        org2 = self.create_organization(name='bar')
        project2 = self.create_project(organization=org2, status=ProjectStatus.PENDING_DELETION)

        self.login_as(user=user)

        response = self.client.get(self.path + '?status=active')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(project1.id)

        response = self.client.get(self.path + '?status=deleted')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(project2.id)

    def test_query_filter(self):
        Project.objects.all().delete()

        user = self.create_user('foo@example.com', is_superuser=True)

        org = self.create_organization(name='foo')
        project1 = self.create_project(name='foo', organization=org)

        org2 = self.create_organization(name='bar')
        self.create_project(name='bar', organization=org2)

        self.login_as(user=user)

        response = self.client.get(self.path + '?query=foo')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(project1.id)

        response = self.client.get(self.path + '?query=baz')
        assert response.status_code == 200
        assert len(response.data) == 0
