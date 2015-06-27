from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import SavedSearch
from sentry.testutils import APITestCase


class ProjectSearchListTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(team=team, name='foo')
        project2 = self.create_project(team=team, name='bar')

        search1 = SavedSearch.objects.create(
            project=project1,
            name='bar',
            query='',
        )
        search2 = SavedSearch.objects.create(
            project=project1,
            name='foo',
            query='',
        )
        SavedSearch.objects.create(
            project=project2,
            name='foo',
            query='',
        )

        url = reverse('sentry-api-0-project-searches', kwargs={
            'organization_slug': project1.organization.slug,
            'project_slug': project1.slug,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['id'] == str(search2.id)
        assert response.data[1]['id'] == str(search1.id)


class ProjectSearchCreateTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project = self.create_project(team=team, name='foo')

        url = reverse('sentry-api-0-project-searches', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        response = self.client.post(url, data={
            'name': 'muted',
            'query': 'is:muted'
        })

        assert response.status_code == 201, response.content
        assert response.data['id']

        assert SavedSearch.objects.filter(
            project=project,
            id=response.data['id'],
        ).exists()

    def test_duplicate(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project = self.create_project(team=team, name='foo')

        SavedSearch.objects.create(name='muted', project=project, query='')

        url = reverse('sentry-api-0-project-searches', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })

        response = self.client.post(url, data={
            'name': 'muted',
            'query': 'is:muted'
        })

        assert response.status_code == 400, response.content
