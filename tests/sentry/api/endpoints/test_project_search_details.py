from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import SavedSearch
from sentry.testutils import APITestCase


class ProjectSearchDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')
        search = SavedSearch.objects.create(
            project=project,
            name='foo',
            query='',
        )

        url = reverse('sentry-api-0-project-search-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'search_id': search.id,
        })
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(search.id)


class UpdateProjectSearchDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')
        search = SavedSearch.objects.create(
            project=project,
            name='foo',
            query='',
        )

        url = reverse('sentry-api-0-project-search-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'search_id': search.id,
        })
        response = self.client.put(url, {'name': 'bar'})

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(search.id)

        search = SavedSearch.objects.get(id=search.id)
        assert search.name == 'bar'


class DeleteProjectSearchTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')
        search = SavedSearch.objects.create(
            project=project,
            name='foo',
            query='',
        )

        url = reverse('sentry-api-0-project-search-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'search_id': search.id,
        })
        response = self.client.delete(url)

        assert response.status_code == 204, response.content

        assert not SavedSearch.objects.filter(id=search.id).exists()
